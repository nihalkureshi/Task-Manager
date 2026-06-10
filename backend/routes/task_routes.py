import re

from flask import Blueprint, request, jsonify
from utils.supabase_client import supabase
from services.email_service import send_email

task_bp = Blueprint("tasks", __name__)

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def is_valid_email(email):
    return bool(email and EMAIL_REGEX.match(email))


def verify_task_ownership(task_id, user_email):
    """Verify if the user is the creator of the task"""
    if not user_email:
        return False, "User email required"
    
    task = supabase.table("tasks").select("created_by").eq("id", task_id).execute()
    
    if not task.data:
        return False, "Task not found"
    
    if task.data[0]["created_by"] != user_email:
        return False, "Not authorized to modify this task"
    
    return True, None


@task_bp.route("/users", methods=["GET"])
def get_users():
    users = supabase.table("users").select("*").execute()
    return jsonify(users.data)


@task_bp.route("/create", methods=["POST"])
def create_task():
    data = request.json
    
    # Validate required fields
    if not data.get("title") or not data.get("description") or not data.get("assigned_to") or not data.get("created_by"):
        return jsonify({"error": "Missing required fields"}), 400
    
    if not is_valid_email(data.get("assigned_to")):
        return jsonify({"error": "Invalid assignee email address"}), 400

    # Prevent self-assignment (optional but good practice)
    if data.get("assigned_to") == data.get("created_by"):
        return jsonify({"error": "Cannot assign task to yourself"}), 400
    
    task = {
        "title": data.get("title"),
        "description": data.get("description"),
        "assigned_to": data.get("assigned_to"),
        "created_by": data.get("created_by"),
        "notes": data.get("notes", ""),
        "status": "pending"
    }
    
    result = supabase.table("tasks").insert(task).execute()
    
    assignee = data.get("assigned_to")
    email_sent = send_email(
        assignee,
        "New Task Assigned",
        "You have been assigned a new task.",
        {
            "Title": data.get("title"),
            "Description": data.get("description"),
            "Created by": data.get("created_by"),
        },
    )

    return jsonify({
        "message": "Task created",
        "task": result.data[0] if result.data else None,
        "email_sent": email_sent,
        "email_to": assignee if email_sent else None,
    })


@task_bp.route("/", methods=["GET"])
def get_tasks():
    tasks = supabase.table("tasks").select("*").order("created_at", desc=True).execute()
    return jsonify(tasks.data)


@task_bp.route("/update/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    """Update task - Only the creator can update"""
    data = request.json
    user_email = request.headers.get('X-User-Email')
    
    # Verify ownership
    is_authorized, error_msg = verify_task_ownership(task_id, user_email)
    if not is_authorized:
        return jsonify({"error": error_msg}), 403 if "Not authorized" in error_msg else 404
    
    # Validate required fields
    if not data.get("title") or not data.get("description") or not data.get("assigned_to"):
        return jsonify({"error": "Missing required fields"}), 400
    
    if not is_valid_email(data.get("assigned_to")):
        return jsonify({"error": "Invalid assignee email address"}), 400

    # Prevent self-assignment
    if data.get("assigned_to") == user_email:
        return jsonify({"error": "Cannot assign task to yourself"}), 400
    
    # Update the task
    updated = (
        supabase
        .table("tasks")
        .update({
            "title": data.get("title"),
            "description": data.get("description"),
            "assigned_to": data.get("assigned_to"),
            "updated_at": "now()"
        })
        .eq("id", task_id)
        .execute()
    )
    
    return jsonify({
        "message": "Task updated",
        "task": updated.data[0] if updated.data else None
    })


@task_bp.route("/delete/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    """Delete task - Only the creator can delete"""
    user_email = request.headers.get('X-User-Email')
    
    # Verify ownership
    is_authorized, error_msg = verify_task_ownership(task_id, user_email)
    if not is_authorized:
        return jsonify({"error": error_msg}), 403 if "Not authorized" in error_msg else 404
    
    # Delete the task
    supabase.table("tasks").delete().eq("id", task_id).execute()
    
    return jsonify({"message": "Task deleted"})


@task_bp.route("/notes/<int:task_id>", methods=["PATCH"])
def update_notes(task_id):
    """Update task notes - Only the creator can update notes"""
    data = request.json
    user_email = request.headers.get('X-User-Email')
    
    # Verify ownership
    is_authorized, error_msg = verify_task_ownership(task_id, user_email)
    if not is_authorized:
        return jsonify({"error": error_msg}), 403 if "Not authorized" in error_msg else 404
    
    # Update notes
    updated = (
        supabase
        .table("tasks")
        .update({"notes": data.get("notes", "")})
        .eq("id", task_id)
        .execute()
    )
    
    return jsonify({
        "message": "Notes updated",
        "task": updated.data[0] if updated.data else None
    })


@task_bp.route("/complete/<int:task_id>", methods=["PATCH"])
def complete_task(task_id):
    """Complete task - Can be completed by assigned person or creator"""
    user_email = request.headers.get('X-User-Email')
    
    if not user_email:
        return jsonify({"error": "User email required"}), 401
    
    # Get task details
    task = supabase.table("tasks").select("*").eq("id", task_id).execute()
    
    if not task.data:
        return jsonify({"error": "Task not found"}), 404
    
    task_data = task.data[0]
    
    # Check if user is assigned to the task or created it
    if task_data["assigned_to"] != user_email and task_data["created_by"] != user_email:
        return jsonify({"error": "Not authorized to complete this task"}), 403
    
    # Check if task is already completed
    if task_data["status"] == "completed":
        return jsonify({"error": "Task already completed"}), 400
    
    # Update task status
    updated = (
        supabase
        .table("tasks")
        .update({"status": "completed"})
        .eq("id", task_id)
        .execute()
    )
    
    # Notify the other party: creator when assignee completes, assignee when creator completes
    notify_email = (
        task_data["created_by"]
        if user_email == task_data["assigned_to"]
        else task_data["assigned_to"]
    )

    email_sent = send_email(
        notify_email,
        "Task Completed",
        "A task has been marked as completed.",
        {
            "Title": task_data["title"],
            "Completed by": user_email,
        },
    )

    return jsonify({
        "message": "Task completed",
        "task": updated.data[0] if updated.data else None,
        "email_sent": email_sent,
        "email_to": notify_email if email_sent else None,
    })


@task_bp.route("/pending/<int:task_id>", methods=["PATCH"])
def reopen_task(task_id):
    """Reopen a completed task - Only the creator can reopen"""
    user_email = request.headers.get('X-User-Email')
    
    # Verify ownership
    is_authorized, error_msg = verify_task_ownership(task_id, user_email)
    if not is_authorized:
        return jsonify({"error": error_msg}), 403 if "Not authorized" in error_msg else 404
    
    # Update task status back to pending
    updated = (
        supabase
        .table("tasks")
        .update({"status": "pending"})
        .eq("id", task_id)
        .execute()
    )
    
    return jsonify({
        "message": "Task reopened",
        "task": updated.data[0] if updated.data else None
    })