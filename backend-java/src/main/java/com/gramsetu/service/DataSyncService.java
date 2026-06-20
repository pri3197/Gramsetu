package com.gramsetu.service;

import com.gramsetu.model.CattleOutbreak;
import com.gramsetu.model.CommodityPrice;
import com.gramsetu.model.NewsArticle;
import com.gramsetu.model.WeatherForecast;
import com.gramsetu.repository.CattleOutbreakRepository;
import com.gramsetu.repository.CommodityPriceRepository;
import com.gramsetu.repository.NewsArticleRepository;
import com.gramsetu.model.GroundwaterRecord;
import com.gramsetu.repository.GroundwaterRecordRepository;
import com.gramsetu.repository.WeatherForecastRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

@Service
public class DataSyncService {

    private static final Logger log = LoggerFactory.getLogger(DataSyncService.class);

    @Value("${gramsetu.python.service.url}")
    private String pythonServiceUrl;

    @Autowired
    private CommodityPriceRepository priceRepository;

    @Autowired
    private CattleOutbreakRepository outbreakRepository;

    @Autowired
    private NewsArticleRepository newsRepository;

    @Autowired
    private WeatherForecastRepository weatherRepository;

    @Autowired
    private GroundwaterRecordRepository groundwaterRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    @EventListener(ApplicationReadyEvent.class)
    public void initDataOnStartup() {
        log.info("Application started. Triggering initial data synchronization...");
        syncAllData();
    }

    @Transactional
    public void syncAllData() {
        syncCommodityPrices();
        syncCattleOutbreaks();
        syncNewsArticles();
        syncWeatherForecasts();
        syncGroundwaterData();
    }

    @Transactional
    public void syncCommodityPrices() {
        log.info("Syncing agricultural commodity prices from Python service: {}/prices", pythonServiceUrl);
        try {
            String url = pythonServiceUrl + "/prices";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get("data");
                if (!records.isEmpty()) {
                    priceRepository.deleteAll();
                    List<CommodityPrice> prices = new ArrayList<>();
                    for (Map<String, Object> r : records) {
                        CommodityPrice p = new CommodityPrice();
                        p.setState((String) r.get("state"));
                        p.setDistrict((String) r.get("district"));
                        p.setMarket((String) r.get("market"));
                        p.setCommodity((String) r.get("commodity"));
                        p.setVariety((String) r.get("variety"));
                        p.setMinPrice(Double.valueOf(r.get("min_price").toString()));
                        p.setMaxPrice(Double.valueOf(r.get("max_price").toString()));
                        p.setModalPrice(Double.valueOf(r.get("modal_price").toString()));
                        p.setUnit((String) r.get("unit"));
                        p.setLastUpdated((String) r.get("last_updated"));
                        prices.add(p);
                    }
                    priceRepository.saveAll(prices);
                    log.info("Successfully synced {} commodity prices.", prices.size());
                    return;
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch prices from Python service ({}). Using local fallback loader. Error: {}", pythonServiceUrl, e.getMessage());
        }

        // Fallback loader if Python service is unreachable during startup
        loadFallbackPrices();
    }

    @Transactional
    public void syncCattleOutbreaks() {
        log.info("Syncing cattle disease outbreaks from Python service: {}/diseases", pythonServiceUrl);
        try {
            String url = pythonServiceUrl + "/diseases";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get("data");
                if (!records.isEmpty()) {
                    outbreakRepository.deleteAll();
                    List<CattleOutbreak> outbreaks = new ArrayList<>();
                    for (Map<String, Object> r : records) {
                        CattleOutbreak o = new CattleOutbreak();
                        o.setState((String) r.get("state"));
                        o.setDistrict((String) r.get("district"));
                        o.setDisease((String) r.get("disease"));
                        o.setLatitude(Double.valueOf(r.get("latitude").toString()));
                        o.setLongitude(Double.valueOf(r.get("longitude").toString()));
                        o.setActiveCases(Integer.valueOf(r.get("active_cases").toString()));
                        o.setSeverity((String) r.get("severity"));
                        o.setTransmission((String) r.get("transmission"));
                        o.setReportDate((String) r.get("report_date"));
                        
                        List<String> vacs = (List<String>) r.get("recommended_vaccines");
                        o.setRecommendedVaccines(String.join(", ", vacs));
                        
                        outbreaks.add(o);
                    }
                    outbreakRepository.saveAll(outbreaks);
                    log.info("Successfully synced {} cattle outbreaks.", outbreaks.size());
                    return;
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch disease outbreaks from Python service ({}). Using local fallback loader. Error: {}", pythonServiceUrl, e.getMessage());
        }

        // Fallback loader if Python service is unreachable during startup
        loadFallbackOutbreaks();
    }

    private void loadFallbackPrices() {
        if (priceRepository.count() > 0) {
            log.info("Database already populated with commodity prices. Skipping fallback.");
            return;
        }
        log.info("Populating database with local fallback grain price data...");
        List<CommodityPrice> fallbacks = new ArrayList<>();
        String today = java.time.LocalDate.now().toString();

        fallbacks.add(new CommodityPrice(null, "Punjab", "Ludhiana", "Ludhiana Mandi", "Wheat (Gehun)", "Kalyan Sona", 2250.0, 2400.0, 2320.0, "Quintal", today));
        fallbacks.add(new CommodityPrice(null, "Punjab", "Amritsar", "Amritsar Mandi", "Paddy (Dhan)", "Basmati", 2800.0, 3100.0, 2950.0, "Quintal", today));
        fallbacks.add(new CommodityPrice(null, "Haryana", "Karnal", "Karnal Mandi", "Wheat (Gehun)", "FAQ", 2280.0, 2380.0, 2330.0, "Quintal", today));
        fallbacks.add(new CommodityPrice(null, "Haryana", "Hisar", "Hisar Mandi", "Barley (Jau)", "Local", 1900.0, 2100.0, 2020.0, "Quintal", today));
        fallbacks.add(new CommodityPrice(null, "Uttar Pradesh", "Mathura", "Mathura Mandi", "Mustard (Sarso)", "Pusa Bold", 5200.0, 5600.0, 5450.0, "Quintal", today));
        fallbacks.add(new CommodityPrice(null, "Madhya Pradesh", "Bhopal", "Bhopal Mandi", "Gram (Chana)", "Desi", 4700.0, 4950.0, 4820.0, "Quintal", today));
        fallbacks.add(new CommodityPrice(null, "Rajasthan", "Kota", "Kota Mandi", "Maize (Makka)", "Yellow", 1900.0, 2050.0, 1980.0, "Quintal", today));

        priceRepository.saveAll(fallbacks);
        log.info("Loaded {} fallback price records.", fallbacks.size());
    }

    private void loadFallbackOutbreaks() {
        if (outbreakRepository.count() > 0) {
            log.info("Database already populated with cattle outbreaks. Skipping fallback.");
            return;
        }
        log.info("Populating database with local fallback cattle disease data...");
        List<CattleOutbreak> fallbacks = new ArrayList<>();
        String date = java.time.LocalDate.now().minusDays(5).toString();

        fallbacks.add(new CattleOutbreak(null, "Rajasthan", "Jodhpur", "Lumpy Skin Disease (LSD)", 26.2389, 73.0243, 45, "High", "Vector-borne (biting flies/mosquitoes)", date, "Lumpy-Provac, Goat Pox Vaccine"));
        fallbacks.add(new CattleOutbreak(null, "Gujarat", "Anand", "Foot and Mouth Disease (FMD)", 22.5645, 72.9289, 28, "Critical", "Direct contact, aerosol transmission", date, "FMD Trivalent Vaccine, Raksha-Ovac"));
        fallbacks.add(new CattleOutbreak(null, "Uttar Pradesh", "Bareilly", "Brucellosis", 28.3670, 79.4304, 12, "Medium", "Contaminated feed, raw milk", date, "Brucella Abortus S19 Strain Vaccine"));
        fallbacks.add(new CattleOutbreak(null, "Tamil Nadu", "Coimbatore", "Black Quarter (BQ)", 11.0168, 76.9558, 8, "High", "Soil-borne bacterial spores", date, "BQ Vaccine (Alum Precipitated)"));

        outbreakRepository.saveAll(fallbacks);
        log.info("Loaded {} fallback disease outbreak records.", fallbacks.size());
    }

    @Transactional
    public void syncNewsArticles() {
        log.info("Syncing news articles from Python service: {}/news", pythonServiceUrl);
        try {
            String url = pythonServiceUrl + "/news";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get("data");
                if (!records.isEmpty()) {
                    newsRepository.deleteAll();
                    List<NewsArticle> articles = new ArrayList<>();
                    for (Map<String, Object> r : records) {
                        NewsArticle a = new NewsArticle();
                        a.setTitle((String) r.get("title"));
                        a.setSummary((String) r.get("summary"));
                        a.setSource((String) r.get("source"));
                        a.setUrl((String) r.get("url"));
                        a.setPublishDate((String) r.get("publishDate"));
                        a.setCategory((String) r.get("category"));
                        a.setTopic((String) r.get("topic"));
                        a.setOutletType((String) r.get("outletType"));
                        articles.add(a);
                    }
                    newsRepository.saveAll(articles);
                    log.info("Successfully synced {} news articles.", articles.size());
                    return;
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch news articles from Python service ({}). Using local fallback loader. Error: {}", pythonServiceUrl, e.getMessage());
        }

        // Fallback loader if Python service is unreachable or fails
        loadFallbackNews();
    }

    private void loadFallbackNews() {
        if (newsRepository.count() > 0) {
            log.info("Database already populated with news articles. Skipping fallback.");
            return;
        }
        log.info("Populating database with local fallback news data...");
        List<NewsArticle> fallbacks = new ArrayList<>();
        String today = java.time.LocalDate.now().toString();

        fallbacks.add(new NewsArticle(null, 
            "Government of India Rolls Out Smart Farming Subsidies for Drone Technology",
            "The Ministry of Agriculture has announced a new 50% subsidy program for smallholder farmer groups buying agricultural drones. Drones will map crop health, perform precision spraying of bio-pesticides, and optimize water application across states like Punjab, Haryana, and Maharashtra.",
            "PIB India", "https://pib.gov.in", today, "Agriculture", "Modern Farming", "Indian"));

        fallbacks.add(new NewsArticle(null, 
            "AI-Powered Vertical Farms in Tokyo Redefine Urban Agri Productivity",
            "Tokyo's new automated indoor vertical farms are leveraging IoT sensors and spectral LED lighting to grow leafy greens and fruits with 95% less water than open fields. The systems monitor plant photosynthesis in real-time, achieving record-high yields for commercial distribution.",
            "FAO Global Reports", "https://www.fao.org", today, "Agriculture", "Modern Farming", "Foreign"));

        fallbacks.add(new NewsArticle(null, 
            "Sikkim's 100% Organic Model Shows Path to Restoring Soil Carbon Levels",
            "A ten-year impact study of Sikkim's complete transition to organic farming reveals a 24% increase in organic soil carbon, significant recovery in beneficial microbial counts, and enhanced drought resilience. Agronomists urge other Indian states to adopt bio-fertilizers and crop rotation.",
            "The Hindu BusinessLine", "https://www.thehindubusinessline.com", today, "Agriculture", "Bio Farming", "Indian"));

        fallbacks.add(new NewsArticle(null, 
            "European Union Bans Four Harmful Chemical Pesticides to Encourage Bio Agriculture",
            "To support the Green Deal targets, the European Commission has restricted several synthetic pesticides linked to pollinator decline. The decision is boosting European investments in bio-rational products, biological controls, and natural composting methods.",
            "FAO Global Reports", "https://www.fao.org", today, "Agriculture", "Bio Farming", "Foreign"));

        fallbacks.add(new NewsArticle(null, 
            "Chennai Fishers Adopt Eco-Friendly Trawlers and Selective Gillnets",
            "To combat overfishing along the Tamil Nadu coast, local fishing cooperatives are modifying their fleets with selective square-mesh nets and light-weight eco-friendly engines. The new gears allow juvenile fish and non-target species to escape, protecting the marine ecosystem.",
            "The Hindu BusinessLine", "https://www.thehindubusinessline.com", today, "Fishery", "New Fishing Ways", "Indian"));

        fallbacks.add(new NewsArticle(null, 
            "Satellite Sonar Mapping Helps Pacific Tuna Fleets Bypass Breeding Hubs",
            "International fisheries regulators are utilizing satellite-based sonar telemetry and machine learning models to map wild tuna migration in real-time. Fishers are dynamically routed away from conservation spawning hotspots, preserving breeding populations while maintaining sustainable catches.",
            "NOAA Fisheries News", "https://www.fisheries.noaa.gov", today, "Fishery", "New Fishing Ways", "Foreign"));

        fallbacks.add(new NewsArticle(null, 
            "Mumbai Shoreline Cleanup Initiated After Offshore Fuel Pipeline Leak Impacts Fishers",
            "Local environmental groups and coast guard teams have deployed containment booms after an offshore oil leak near Mumbai. The incident has halted artisanal coastal fishing in adjacent villages, raising concerns over petroleum hydrocarbons entering the local food chain and damaging nursery grounds.",
            "DownToEarth", "https://www.downtoearth.org.in", today, "Fishery", "Oil Spills", "Indian"));

        fallbacks.add(new NewsArticle(null, 
            "Red Sea Cargo Ship Spill Threatens Coral Reefs and Artisanal Fishermen Livelihoods",
            "An oil slick spanning over 40 kilometers from a damaged merchant vessel is threatening coastal fisheries in the southern Red Sea. Marine biologists warn of long-term toxicity to coastal shellfish populations, which serves as the primary protein source and livelihood for thousands of local fishermen.",
            "National Geographic", "https://www.nationalgeographic.com", today, "Fishery", "Oil Spills", "Foreign"));

        fallbacks.add(new NewsArticle(null, 
            "Monsoon Shifting: How Heatwaves Are Forcing Indian Wheat Farmers to Reschedule Sowing",
            "Extreme heat in early November is delaying wheat germination across Indo-Gangetic plains. The Indian Council of Agricultural Research (ICAR) is urging farmers to shift to heat-tolerant varieties and utilize mulching techniques to preserve soil moisture against climate change anomalies.",
            "DownToEarth", "https://www.downtoearth.org.in", today, "Agriculture", "Climate Change", "Indian"));

        fallbacks.add(new NewsArticle(null, 
            "Warming Oceans Force Indian Ocean Mackerel and Tuna to Migrate to Cooler Waters",
            "Sea surface temperatures in the Indian Ocean have risen by 1.2 degrees Celsius, driving pelagic fish schools like mackerel and sardines away from traditional coastal zones to deeper offshore waters. Fishing communities report a drop in daily catches, prompting calls for climate resilience aids.",
            "NOAA Fisheries News", "https://www.fisheries.noaa.gov", today, "Fishery", "Climate Change", "Foreign"));

        newsRepository.saveAll(fallbacks);
        log.info("Loaded {} fallback news articles.", fallbacks.size());
    }

    @Transactional
    public void syncWeatherForecasts() {
        log.info("Syncing weather forecasts from Python service: {}/weather/forecast", pythonServiceUrl);
        try {
            String url = pythonServiceUrl + "/weather/forecast";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get("data");
                if (!records.isEmpty()) {
                    weatherRepository.deleteAll();
                    List<WeatherForecast> forecasts = new ArrayList<>();
                    for (Map<String, Object> r : records) {
                        WeatherForecast f = new WeatherForecast();
                        f.setRegion((String) r.get("region"));
                        f.setCurrentTemp(Double.valueOf(r.get("current_temp").toString()));
                        f.setForecast((String) r.get("forecast"));
                        f.setElNinoStatus((String) r.get("el_nino_status"));
                        f.setElNinoImpact((String) r.get("el_nino_impact"));
                        f.setAnomalyIndex(Double.valueOf(r.get("anomaly_index").toString()));
                        forecasts.add(f);
                    }
                    weatherRepository.saveAll(forecasts);
                    log.info("Successfully synced {} weather forecasts.", forecasts.size());
                    return;
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch weather forecasts from Python service ({}). Using local fallback loader. Error: {}", pythonServiceUrl, e.getMessage());
        }

        // Fallback loader if Python service is unreachable during startup
        loadFallbackWeather();
    }

    private void loadFallbackWeather() {
        if (weatherRepository.count() > 0) {
            log.info("Database already populated with weather forecasts. Skipping fallback.");
            return;
        }
        log.info("Populating database with local fallback weather data...");
        List<WeatherForecast> fallbacks = new ArrayList<>();

        fallbacks.add(new WeatherForecast(null, "North India (Indo-Gangetic Plain)", 38.5, 
            "Dry & Extremely Hot. Heatwave warnings in place.", "Active (Moderate-Strong)", 
            "Monsoon winds delayed by 8 days. 15% rainfall deficit expected. Drought advisory active.", 1.4));
        fallbacks.add(new WeatherForecast(null, "Western Ghats & Coastal Maharashtra", 29.0, 
            "Moderate Monsoonal Rain. Storm surges active.", "Active (Moderate-Strong)", 
            "Suppressing monsoonal wind circulation. Rainfall deficit of 12% mapped.", 1.4));
        fallbacks.add(new WeatherForecast(null, "Eastern Coastal States (Tamil Nadu / AP)", 32.5, 
            "Overcast, light showers, high humidity.", "Active (Moderate-Strong)", 
            "Often leads to an increase in late northeast monsoon rainfall (October-December) but suppresses southwest monsoons.", 1.4));
        fallbacks.add(new WeatherForecast(null, "Central Dry Zone (MP / Vidarbha)", 41.0, 
            "Arid, clear skies, severe heat warnings.", "Active (Moderate-Strong)", 
            "High risk of drought. Soil moisture is 22% below baseline. Farmers urged to delay paddy transplantation.", 1.4));

        weatherRepository.saveAll(fallbacks);
        log.info("Loaded {} fallback weather records.", fallbacks.size());
    }

    @Transactional
    public void syncGroundwaterData() {
        log.info("Syncing groundwater data from Python service: {}/weather/groundwater", pythonServiceUrl);
        try {
            String url = pythonServiceUrl + "/weather/groundwater";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get("data");
                if (!records.isEmpty()) {
                    groundwaterRepository.deleteAll();
                    List<GroundwaterRecord> list = new ArrayList<>();
                    for (Map<String, Object> r : records) {
                        GroundwaterRecord gr = new GroundwaterRecord();
                        gr.setState((String) r.get("state"));
                        gr.setDistrict((String) r.get("district"));
                        gr.setLatitude(Double.valueOf(r.get("latitude").toString()));
                        gr.setLongitude(Double.valueOf(r.get("longitude").toString()));
                        gr.setYear(Integer.valueOf(r.get("year").toString()));
                        gr.setWaterTableDepth(Double.valueOf(r.get("waterTableDepth").toString()));
                        gr.setSewageContamination(Double.valueOf(r.get("sewageContamination").toString()));
                        gr.setDepletionRate(Double.valueOf(r.get("depletionRate").toString()));
                        list.add(gr);
                    }
                    groundwaterRepository.saveAll(list);
                    log.info("Successfully synced {} groundwater records.", list.size());
                    return;
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch groundwater data from Python service ({}). Using local fallback loader. Error: {}", pythonServiceUrl, e.getMessage());
        }

        // Fallback loader if Python service is unreachable
        loadFallbackGroundwater();
    }

    private void loadFallbackGroundwater() {
        if (groundwaterRepository.count() > 0) {
            log.info("Database already populated with groundwater data. Skipping fallback.");
            return;
        }
        log.info("Populating database with local fallback groundwater data...");
        List<GroundwaterRecord> fallbacks = new ArrayList<>();
        
        // Define some realistic data for 2016-2026
        // Format: state, district, lat, lng, base_depth, base_sewage_ratio, rate_per_year
        Object[][] configs = {
            {"Punjab", "Ludhiana", 30.9010, 75.8573, 24.5, 45.0, 1.2},
            {"Punjab", "Amritsar", 31.6340, 74.8723, 18.0, 35.0, 0.8},
            {"Rajasthan", "Jaipur", 26.9124, 75.7873, 35.0, 50.0, 1.8},
            {"Rajasthan", "Jodhpur", 26.2389, 73.0243, 42.0, 30.0, 2.1},
            {"Uttar Pradesh", "Mathura", 27.4924, 77.6737, 25.0, 60.0, 1.3},
            {"Maharashtra", "Pune", 18.5204, 73.8567, 14.0, 55.0, 0.5},
            {"Karnataka", "Mysore", 12.2958, 76.6394, 12.0, 30.0, 0.4}
        };
        
        for (Object[] c : configs) {
            String state = (String) c[0];
            String district = (String) c[1];
            double lat = (double) c[2];
            double lng = (double) c[3];
            double baseDepth = (double) c[4];
            double baseSewage = (double) c[5];
            double rate = (double) c[6];
            
            for (int year = 2016; year <= 2026; year++) {
                int diff = year - 2016;
                double depth = baseDepth + (diff * rate);
                double sewage = baseSewage + (diff * 2.0);
                sewage = Math.min(100.0, sewage);
                
                fallbacks.add(new GroundwaterRecord(null, state, district, lat, lng, year, depth, sewage, rate));
            }
        }
        
        groundwaterRepository.saveAll(fallbacks);
        log.info("Loaded {} fallback groundwater records.", fallbacks.size());
    }
}
