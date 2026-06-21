import os
import shutil
import tempfile
import datetime
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from classifier import BirdAudioClassifier
from data_fetcher import DataFetcher

app = FastAPI(
    title="GramSetu AI & Data Service",
    description="Python microservice for bird sound classification and public agricultural data aggregation",
    version="1.0.0"
)

# Enable CORS for local cross-origin communication between services
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize modules
classifier = BirdAudioClassifier()

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "GramSetu Python API",
        "endpoints": ["/health", "/classify-bird", "/prices", "/diseases"]
    }

@app.get("/health")
def health_check():
    return {"status": "UP", "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

@app.post("/classify-bird")
async def classify_bird(file: UploadFile = File(...)):
    """
    Receives an audio file, analyzes it, and returns the classification result.
    Supported extensions: .wav, .mp3, .webm, .m4a, etc.
    """
    # Verify file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".wav", ".webm", ".mp3", ".ogg", ".m4a", ".aac", ".3gp"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format '{ext}'. Please upload an audio file."
        )

    # Save to a temporary file
    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, f"upload_{os.urandom(8).hex()}{ext}")
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Run classification
        result = classifier.classify(temp_file_path)
        return result

    except Exception as e:
        print(f"Exception during file upload/analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {str(e)}")
    
    finally:
        # Clean up temporary file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as cleanup_err:
                print(f"Failed to delete temp file {temp_file_path}: {str(cleanup_err)}")

@app.get("/prices")
def get_mandi_prices(api_key: str = Query(None, description="API Key for data.gov.in (Optional)")):
    """
    Fetches the latest agricultural mandi prices in India.
    Falls back to high-fidelity mock data if no key is provided or the service is offline.
    """
    fetcher = DataFetcher(api_key=api_key)
    try:
        prices = fetcher.fetch_mandi_prices()
        return {"count": len(prices), "data": prices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch commodity prices: {str(e)}")

@app.get("/diseases")
def get_cattle_diseases():
    """
    Retrieves the latest cattle disease outbreaks and recommended vaccinations.
    """
    fetcher = DataFetcher()
    try:
        outbreaks = fetcher.fetch_cattle_disease_outbreaks()
        return {"count": len(outbreaks), "data": outbreaks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cattle disease outbreaks: {str(e)}")

@app.get("/news")
def get_news():
    """
    Scrapes and returns latest news on agriculture and fisheries.
    """
    fetcher = DataFetcher()
    try:
        articles = fetcher.fetch_news_articles()
        return {"count": len(articles), "data": articles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch news articles: {str(e)}")

@app.get("/weather/forecast")
def get_weather_forecast():
    """
    Returns regional weather forecasts and El Nino impact reports.
    """
    fetcher = DataFetcher()
    try:
        forecasts = fetcher.fetch_weather_forecasts()
        return {"count": len(forecasts), "data": forecasts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch weather forecasts: {str(e)}")

@app.get("/weather/trends")
def get_climate_trends():
    """
    Returns annual climate anomalies and rainfall deviations.
    """
    fetcher = DataFetcher()
    try:
        trends = fetcher.fetch_climate_trends()
        return {"count": len(trends), "data": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch climate trends: {str(e)}")

@app.get("/weather/groundwater")
def get_groundwater_data():
    """
    Returns annual groundwater table levels and sewage mixing percentage for districts.
    """
    fetcher = DataFetcher()
    try:
        data = fetcher.fetch_groundwater_data()
        return {"count": len(data), "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch groundwater data: {str(e)}")

@app.get("/fisheries/imd-warnings")
def get_imd_warnings():
    """
    Scrapes and returns the latest live fishermen weather warnings from IMD.
    """
    fetcher = DataFetcher()
    try:
        warnings = fetcher.fetch_imd_fisherman_warnings()
        return {"count": len(warnings), "data": warnings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch IMD warnings: {str(e)}")

@app.get("/fisheries/mangroves/historical")
def get_historical_mangroves():
    """
    Returns state-wise historical FSI Mangrove Cover data (2005-2023).
    """
    fetcher = DataFetcher()
    try:
        data = fetcher.fetch_historical_mangroves()
        return {"count": len(data), "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical mangrove data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Local development server on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)

