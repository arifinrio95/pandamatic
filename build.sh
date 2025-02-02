#!/usr/bin/env bash
apt-get update -y && apt-get install -y \
    python3-dev \
    build-essential \
    python3-pip \
    python3-venv \
    python3-wheel \
    libpango-1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    libffi-dev \
    libjpeg-dev \
    libopenjp2-7-dev \
    libfreetype6-dev

pip install --upgrade pip
pip install -r requirements.txt