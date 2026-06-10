from flask import Blueprint, request, jsonify
from google.oauth2 import id_token
from google.auth.transport import requests
from utils.supabase_client import supabase
from dotenv import load_dotenv
import uuid
import os

load_dotenv()

auth_bp = Blueprint("auth", __name__)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
@auth_bp.route("/save-user", methods=["POST"])
def save_user():

    data = request.json

    email = data.get("email")
    name = data.get("name")

    existing_user = (
        supabase
        .table("users")
        .select("*")
        .eq("email", email)
        .execute()
    )

    if not existing_user.data:

        user_data = {
            "id": str(uuid.uuid4()),
            "name": name,
            "email": email
        }

        supabase.table("users").insert(user_data).execute()

    return jsonify({
        "message": "User saved"
    })


@auth_bp.route("/google", methods=["POST"])
def google_login():

    try:

        body = request.get_json()

        token = body.get("token")

        print("TOKEN:", token)
        print("CLIENT ID:", GOOGLE_CLIENT_ID)

        user_info = id_token.verify_oauth2_token(
                    token,
                    requests.Request(),
                    GOOGLE_CLIENT_ID,
                    clock_skew_in_seconds=15
        )

        print("USER INFO:", user_info)

        email = user_info["email"]
        name = user_info["name"]

        existing_user = (
            supabase
            .table("users")
            .select("*")
            .eq("email", email)
            .execute()
        )

        if not existing_user.data:

            user_data = {
                "id": str(uuid.uuid4()),
                "name": name,
                "email": email
            }

            supabase.table("users").insert(user_data).execute()

        return jsonify({
            "message": "Login successful",
            "user": {
                "name": name,
                "email": email
            }
        })

    except Exception as e:

        print("GOOGLE LOGIN ERROR:", str(e))

        return jsonify({
            "error": str(e)
        }), 400