from flask import Flask
from flask_cors import CORS

from routes.auth_routes import auth_bp
from routes.task_routes import task_bp

app = Flask(__name__)

CORS(
    app,
    resources={r"/*": {"origins": "*"}}
)

app.register_blueprint(
    auth_bp,
    url_prefix="/auth"
)

app.register_blueprint(
    task_bp,
    url_prefix="/tasks"
)

@app.route("/")
def home():
    return {
        "message": "Backend Running"
    }

if __name__ == "__main__":
    app.run(debug=True)