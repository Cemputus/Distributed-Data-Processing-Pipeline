from flask import Flask, jsonify
from flask_cors import CORS

from .config import Settings
from .routes import create_api_blueprint


def app_factory() -> Flask:
    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(create_api_blueprint(data_dir=Settings.DATA_DIR))

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        return jsonify({"error": "internal_error", "message": str(error)}), 500

    return app


app = app_factory()
