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
        log.info("Application started. Triggering initial data synchronization in background...");
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            int retries = 5;
            int delayMs = 6000;
            boolean success = false;
            for (int i = 0; i < retries; i++) {
                try {
                    log.info("Attempting data synchronization (attempt {}/{})...", i + 1, retries);
                    syncAllData();
                    success = true;
                    log.info("Initial data synchronization completed successfully.");
                    break;
                } catch (Exception e) {
                    log.warn("Attempt {} failed to synchronize data: {}. Retrying in {}ms...", i + 1, e.getMessage(), delayMs);
                    try {
                        Thread.sleep(delayMs);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
            if (!success) {
                log.error("Failed to complete initial data synchronization after {} attempts.", retries);
            }
        });
    }

    public void syncAllData() {
        log.info("Data synchronization is bypassed because all datasets are loaded in real-time from the Python API service.");
        // syncCommodityPrices();
        // syncCattleOutbreaks();
        // syncNewsArticles();
        // syncWeatherForecasts();
        // syncGroundwaterData();
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
            throw new RuntimeException("Empty response or missing data from Python service");
        } catch (Exception e) {
            log.error("Could not fetch prices from Python service ({}). Error: {}", pythonServiceUrl, e.getMessage());
            throw new RuntimeException("Price sync failed: " + e.getMessage(), e);
        }
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
            throw new RuntimeException("Empty response or missing data from Python service");
        } catch (Exception e) {
            log.error("Could not fetch disease outbreaks from Python service ({}). Error: {}", pythonServiceUrl, e.getMessage());
            throw new RuntimeException("Cattle outbreaks sync failed: " + e.getMessage(), e);
        }
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
            throw new RuntimeException("Empty response or missing data from Python service");
        } catch (Exception e) {
            log.error("Could not fetch news articles from Python service ({}). Error: {}", pythonServiceUrl, e.getMessage());
            throw new RuntimeException("News sync failed: " + e.getMessage(), e);
        }
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
            throw new RuntimeException("Empty response or missing data from Python service");
        } catch (Exception e) {
            log.error("Could not fetch weather forecasts from Python service ({}). Error: {}", pythonServiceUrl, e.getMessage());
            throw new RuntimeException("Weather forecasts sync failed: " + e.getMessage(), e);
        }
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
            throw new RuntimeException("Empty response or missing data from Python service");
        } catch (Exception e) {
            log.error("Could not fetch groundwater data from Python service ({}). Error: {}", pythonServiceUrl, e.getMessage());
            throw new RuntimeException("Groundwater sync failed: " + e.getMessage(), e);
        }
    }
}
