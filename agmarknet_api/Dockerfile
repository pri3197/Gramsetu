FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy application code
COPY app.py ./

# Install Flask and requests (required dependencies)
RUN pip install --no-cache-dir flask requests

# Expose Flask default port
EXPOSE 5000

# Run the Flask app
CMD ["python", "app.py"]
