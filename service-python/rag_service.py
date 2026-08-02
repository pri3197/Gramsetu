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
        self.ai_model = "gemini-2.0-flash-lite"

    def is_time_sensitive_query(self, prompt: str) -> bool:
        """
        Detects if a query is time-sensitive and requires live web search grounding.
        """
        p = prompt.lower()
        keywords = ['still', 'currently', 'latest', 'today', 'now', 'recent', 'hunger strike', 'protest', 'news', 'weather', 'price', 'is ', 'are ', 'where ', 'why ']
        return any(kw in p for kw in keywords)

    def extract_location(self, prompt: str) -> str | None:
        details = self.extract_location_details(prompt)
        return details.get("city") or details.get("state")

    def extract_location_details(self, prompt: str) -> dict:
        """
        ST-1.1.2: Location Entity Extraction for city, state, district, landmark.
        """
        p = prompt.lower()
        landmarks = {
            "azad maidan": ("Mumbai", "Maharashtra"),
            "jantar mantar": ("Delhi", "Delhi"),
            "singhu": ("Delhi", "Delhi"),
            "tikri": ("Delhi", "Delhi"),
            "ramlila": ("Delhi", "Delhi"),
            "parliament": ("Delhi", "Delhi")
        }

        landmark_found = None
        city_found = None
        state_found = None

        for lm, (c, s) in landmarks.items():
            if lm in p:
                landmark_found = lm.title()
                city_found = c
                state_found = s
                break

        if not city_found:
            city_map = {
                "mumbai": "Maharashtra", "delhi": "Delhi", "bengaluru": "Karnataka",
                "bangalore": "Karnataka", "pune": "Maharashtra", "hyderabad": "Telangana",
                "chennai": "Tamil Nadu", "kolkata": "West Bengal", "leh": "Ladakh",
                "nashik": "Maharashtra", "nagpur": "Maharashtra"
            }
            for c, s in city_map.items():
                if c in p:
                    city_found = c.title()
                    state_found = s
                    break

        if not state_found:
            state_list = ["maharashtra", "punjab", "haryana", "delhi", "ladakh", "karnataka", "tamil nadu", "west bengal", "uttar pradesh", "rajasthan"]
            for st in state_list:
                if st in p:
                    state_found = st.title()
                    break

        return {
            "city": city_found,
            "state": state_found,
            "landmark": landmark_found
        }

    def classify_protest_intent(self, prompt: str) -> dict:
        """
        ST-1.1.1: Protest Intent Classification Taxonomy.
        Classifies queries into: PROTEST_QUERY, STRIKE_QUERY, DEMONSTRATION_QUERY, CIVIL_UNREST_QUERY, MOVEMENT_QUERY, or GENERAL
        """
        p = prompt.lower()
        loc_details = self.extract_location_details(prompt)
        time_context = "historical" if any(w in p for w in ["history", "past", "19", "2020", "2021", "historical"]) else "current"

        if "strike" in p or "bandh" in p or "work stoppage" in p:
            intent = "STRIKE_QUERY"
        elif "demonstration" in p or "rally" in p or "march" in p or "dharna" in p:
            intent = "DEMONSTRATION_QUERY"
        elif "unrest" in p or "clash" in p or "agitation" in p:
            intent = "CIVIL_UNREST_QUERY"
        elif "movement" in p or "andolan" in p:
            intent = "MOVEMENT_QUERY"
        elif "protest" in p or "protesting" in p or "protesters" in p or "fast" in p:
            intent = "PROTEST_QUERY"
        else:
            intent = "GENERAL"

        return {
            "intent": intent,
            "location": loc_details.get("city") or loc_details.get("state") or "India",
            "city": loc_details.get("city"),
            "state": loc_details.get("state"),
            "landmark": loc_details.get("landmark"),
            "time_context": time_context
        }

    def gather_context(self) -> str:
        """
        Gathers real-time data from various endpoints to build context.
        """
        context = "Here is local real-time context from GramSetu:\n\n"
        
        try:
            prices = self.fetcher.fetch_mandi_prices()
            if prices:
                context += "### Recent Mandi Prices:\n"
                for p in prices[:5]:
                    context += f"- {p.get('commodity')} in {p.get('market')}, {p.get('state')}: {p.get('modal_price')} rs/{p.get('unit')}\n"
        except Exception:
            pass

        try:
            forecasts = self.fetcher.fetch_weather_forecasts()
            if forecasts:
                context += "\n### Weather Forecasts:\n"
                for f in forecasts[:3]:
                    context += f"- {f.get('date')} ({f.get('district')}, {f.get('state')}): Temp {f.get('temp_min')}-{f.get('temp_max')}C, Rainfall {f.get('rainfall')}mm, Hum {f.get('humidity')}%, Wind {f.get('wind_speed')}kmph\n"
        except Exception:
            pass

        try:
            news = self.fetcher.fetch_news_articles()
            if news:
                context += "\n### Latest Agriculture News:\n"
                for n in news[:3]:
                    context += f"- {n.get('title')} ({n.get('date')}): {n.get('summary')}\n"
        except Exception:
            pass

        return context

    def generate_response_dict(self, prompt: str) -> dict:
        context = self.gather_context()
        api_key = os.environ.get("GEMINI_API_KEY", "")
        time_sensitive = self.is_time_sensitive_query(prompt)
        intent_info = self.classify_protest_intent(prompt)
        detected_location = intent_info.get("location")

        if not api_key:
            return {
                "response": "Configuration Error: GEMINI_API_KEY environment variable is not set. Please add it to your .env.local file to use the AI chatbot.",
                "grounded": False,
                "time_sensitive": time_sensitive,
                "intent": intent_info,
                "sources": []
            }
            
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"
        
        protest_instruction = ""
        if intent_info["intent"] != "GENERAL":
            protest_instruction = (
                f"\nST-1.1.3 STRUCTURED PROTEST INSTRUCTION (Intent: {intent_info['intent']}, Location: {detected_location}):\n"
                "Provide a comprehensive, factual, grounded response structured into clear sections:\n"
                "1. Protest Name / Movement\n"
                "2. Current Status & Location\n"
                "3. Organizers & Participants\n"
                "4. Main Demands\n"
                "5. Government / Police Response\n"
                "6. Timeline & Historical Context\n"
            )
        elif detected_location:
            protest_instruction = (
                f"\nCRITICAL LOCATION CONSTRAINT: The user specifically asked about '{detected_location}'. "
                f"Your response MUST be restricted strictly to '{detected_location}'. Do NOT return broad national summaries."
            )

        constitution_doc_url = "https://www.indiacode.nic.in/bitstream/123456789/19632/1/the_constitution_of_india.pdf"

        system_instruction = (
            "You are GramSetu Mesh AI Assistant, a specialized Retrieval-Augmented Generation (RAG) system "
            f"grounded in the official document: The Constitution of India ({constitution_doc_url}).\n"
            "Your answers MUST be strictly based on and reference relevant Articles, Parts, Schedules, and Amendments of The Constitution of India. "
            "When answering user questions, cite specific Articles (e.g. Article 14, Article 19, Article 21, Article 32, Article 243 for Panchayats, 73rd Amendment, etc.) "
            "and explain how the Constitution of India applies to their question.\n"
            f"Primary Grounded Document Source: {constitution_doc_url}\n"
            f"{protest_instruction}\n"
            f"Local Context (use if relevant):\n{context}"
        )

        payload = {
            "contents": [{
                "parts": [{"text": f"{system_instruction}\n\nUser Question:\n{prompt}"}]
            }],
            "tools": [{"googleSearch": {}}]
        }
        
        headers = {
            "Content-Type": "application/json",
            "X-goog-api-key": api_key
        }
        
        print(f"[Protest Classifier Log] Intent: {intent_info['intent']} | Location: {detected_location} | Landmark: {intent_info.get('landmark')} | TimeContext: {intent_info.get('time_context')}")

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()

            candidate = data.get("candidates", [{}])[0]
            parts = candidate.get("content", {}).get("parts", [])
            answer = "".join([p.get("text", "") for p in parts if "text" in p])

            # Extract grounding metadata
            grounding_meta = candidate.get("groundingMetadata", {})
            search_queries = grounding_meta.get("webSearchQueries", [])
            grounding_chunks = grounding_meta.get("groundingChunks", [])
            sources = [
                {
                    "title": "The Constitution of India (Official PDF)",
                    "url": constitution_doc_url
                }
            ]

            for chunk in grounding_chunks:
                web = chunk.get("web", {})
                if web and web.get("uri") and web.get("uri") != constitution_doc_url:
                    sources.append({"title": web.get("title", "Web Source"), "url": web.get("uri")})

            is_grounded = True

            print(f"[Gemini Gateway Log] Status: 200 | RAG Document: Constitution of India | Intent: {intent_info['intent']} | Grounded: {is_grounded} | Sources: {len(sources)}")

            return {
                "response": answer if answer else f"No content returned from Gemini API for {detected_location or 'query'}.",
                "grounded": is_grounded,
                "time_sensitive": time_sensitive,
                "intent": intent_info,
                "sources": sources,
                "search_queries": search_queries
            }

        except Exception as e:
            err_msg = f"Gemini API generation failed: {e}"
            print(f"[Gemini Gateway Error] {err_msg}")
            if 'response' in locals() and response is not None:
                print(f"[Gemini Gateway Error Body] {response.text}")
            return {
                "response": f"Error connecting to AI service: {err_msg}",
                "grounded": False,
                "time_sensitive": time_sensitive,
                "intent": intent_info,
                "sources": [],
                "error": str(e)
            }

    def generate_response(self, prompt: str) -> str:
        result = self.generate_response_dict(prompt)
        answer = result["response"]
        if result.get("grounded"):
            return f"[Grounded: Live Search] {answer}"
        return answer
