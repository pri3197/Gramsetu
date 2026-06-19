package com.gramsetu.service;

import com.gramsetu.model.CattleOutbreak;
import com.gramsetu.model.CommodityPrice;
import com.gramsetu.repository.CattleOutbreakRepository;
import com.gramsetu.repository.CommodityPriceRepository;
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
}
