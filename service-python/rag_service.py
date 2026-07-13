import os
import requests
import json
import time
from data_fetcher import DataFetcher
import socket

# Force IPv4 because IPv6 might blackhole and cause timeout
orig_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4(*args, **kwargs):
    if len(args) >= 2:
        args = (args[0], args[1], socket.AF_INET) + args[3:]
    elif "family" in kwargs:
        kwargs["family"] = socket.AF_INET
    else:
        kwargs["family"] = socket.AF_INET
    return orig_getaddrinfo(*args, **kwargs)
socket.getaddrinfo = getaddrinfo_ipv4

class RAGService:
    def __init__(self):
        self.fetcher = DataFetcher()
        self.ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")

    def gather_context(self) -> str:
        """
        Gathers real-time data from various endpoints to build context.
        """
        context = "Here is the latest data from GramSetu:\n\n"
        
        try:
            # 1. Mandi Prices
            prices = self.fetcher.fetch_mandi_prices()
            if prices:
                context += "### Recent Mandi Prices:\n"
                for p in prices[:5]: # limit to top 5
                    context += f"- {p.get('commodity')} in {p.get('market')}, {p.get('state')}: {p.get('modal_price')} rs/{p.get('unit')}\n"
        except Exception as e:
            pass

        try:
            # 2. Weather
            forecasts = self.fetcher.fetch_weather_forecasts()
            if forecasts:
                context += "\n### Weather Forecasts:\n"
                for f in forecasts[:3]:
                    context += f"- {f.get('date')} ({f.get('district')}, {f.get('state')}): Temp {f.get('temp_min')}-{f.get('temp_max')}C, Rainfall {f.get('rainfall')}mm, Hum {f.get('humidity')}%, Wind {f.get('wind_speed')}kmph\n"
        except Exception as e:
            pass

        try:
            # 3. News
            news = self.fetcher.fetch_news_articles()
            if news:
                context += "\n### Latest Agriculture News:\n"
                for n in news[:3]:
                    context += f"- {n.get('title')} ({n.get('date')}): {n.get('summary')}\n"
        except Exception as e:
            pass

        return context

    def generate_response(self, prompt: str) -> str:
        context = self.gather_context()
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            api_key = ""
        
        system_prompt = (
            "You are GramSetu AI, an expert agricultural assistant for Indian farmers. "
            "You answer questions in a concise, friendly manner. "
            "Use the provided real-time data to answer the user's questions if relevant. "
            "If the data does not contain the answer, use your general knowledge but mention you are not using live data.\n\n"
            f"{context}\n"
        )
        
        if not api_key:
            return "Configuration Error: GEMINI_API_KEY environment variable is not set. Please add it to your .env.local file to use the AI chatbot."
            
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"
        
        payload = {
            "contents": [{
                "parts": [{"text": f"System Context:\n{system_prompt}\n\nUser Question:\n{prompt}"}]
            }]
        }
        
        headers = {
            "Content-Type": "application/json",
            "X-goog-api-key": api_key
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            err_msg = f"Gemini API generation failed: {e}"
            print(err_msg)
            if 'response' in locals() and response is not None:
                err_msg += f"\nResponse: {response.text}"
                print(f"Response: {response.text}")
            return f"Error connecting to AI: {err_msg}"
