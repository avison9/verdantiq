# FROM python:3.11
FROM python:3.8

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    procps \
    curl \
    gnupg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64


ENV PATH="${JAVA_HOME}/bin:${PATH}"

WORKDIR /app

# RUN python -m pip install --upgrade pip && pip install virtualenv

# RUN python -m venv /app/venv

COPY backend/test-infra/requirements.txt /app/requirements.txt

# RUN /app/venv/bin/python -m pip install --upgrade docker
RUN python -m pip install --upgrade docker

# RUN /app/venv/bin/python -m pip install --upgrade pip && /app/venv/bin/pip install --no-cache-dir -r /app/requirements.txt
RUN python -m pip install --upgrade pip && pip install --no-cache-dir -r /app/requirements.txt

RUN mkdir -p /app/jars


COPY backend/test-infra/tests/test_infrastructure.py ./tests/test_infrastructure.py

COPY backend/libs/jdbc/ /app/jars/

# CMD ["sh", "-c", "/app/venv/bin/python -m pytest tests/test_infrastructure.py"]
CMD ["sh", "-c", "python -m pytest tests/test_infrastructure.py"]