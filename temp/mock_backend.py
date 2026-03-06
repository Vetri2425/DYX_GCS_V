# Mock Backend Server for DYX-GCS-Mobile Development
# Simulates the real backend at 192.168.0.212:5001
# Frontend won't know it's mocked

import asyncio
import json
import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from datetime import datetime
import random
import time

# Mock server configuration
MOCK_HOST = '0.0.0.0'
MOCK_PORT = 5002

# Initialize FastAPI]

app = FastAPI()
