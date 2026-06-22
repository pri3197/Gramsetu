package com.gramsetu.controller;

import com.gramsetu.model.BirdSighting;
import com.gramsetu.model.CattleOutbreak;
import com.gramsetu.model.CommodityPrice;
import com.gramsetu.repository.CattleOutbreakRepository;
import com.gramsetu.repository.CommodityPriceRepository;
import com.gramsetu.service.BirdSightingService;
import com.gramsetu.service.DataSyncService;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class DashboardController {

    private static final Logger log = LoggerFactory.getLogger(DashboardController.class);

    @Value("${gramsetu.python.service.url}")
    private String pythonServiceUrl;

    @Autowired
    private CommodityPriceRepository priceRepository;

    @Autowired
    private CattleOutbreakRepository outbreakRepository;

    @Autowired
    private BirdSightingService birdSightingService;

    @Autowired
    private DataSyncService dataSyncService;

    private final RestTemplate restTemplate = new RestTemplate();

    private List<CommodityPrice> fetchPricesFromPythonService() {
        try {
            String url = pythonServiceUrl + "/prices";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            List<CommodityPrice> prices = new ArrayList<>();
            if (response != null && response.containsKey("data")) {
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get("data");
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
            }
            return prices;
        } catch (Exception e) {
            log.error("Failed to fetch commodity prices from Python API: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    @GetMapping("/prices")
    public ResponseEntity<List<CommodityPrice>> getPrices() {
        return ResponseEntity.ok(fetchPricesFromPythonService());
    }

    @GetMapping("/prices/states")
    public ResponseEntity<List<String>> getStates() {
        List<CommodityPrice> prices = fetchPricesFromPythonService();
        List<String> states = prices.stream()
                .map(CommodityPrice::getState)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        return ResponseEntity.ok(states);
    }

    @GetMapping("/prices/commodities")
    public ResponseEntity<List<String>> getCommodities() {
        List<CommodityPrice> prices = fetchPricesFromPythonService();
        List<String> commodities = prices.stream()
                .map(CommodityPrice::getCommodity)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        return ResponseEntity.ok(commodities);
    }

    private List<CattleOutbreak> fetchOutbreaksFromPythonService() {
        try {
            String url = pythonServiceUrl + "/diseases";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            List<CattleOutbreak> outbreaks = new ArrayList<>();
            if (response != null && response.containsKey("data")) {
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get("data");
                for (Map<String, Object> r : records) {
                    CattleOutbreak o = new CattleOutbreak();
                    o.setState((String) r.get("state"));
                    o.setDistrict((String) r.get("district"));
                    o.setLatitude(Double.valueOf(r.get("latitude").toString()));
                    o.setLongitude(Double.valueOf(r.get("longitude").toString()));
                    o.setDisease((String) r.get("disease"));
                    o.setSeverity((String) r.get("severity"));
                    o.setTransmission((String) r.get("transmission"));
                    o.setRecommendedVaccines((String) r.get("recommendedVaccines"));
                    o.setActiveCases(Integer.valueOf(r.get("activeCases").toString()));
                    outbreaks.add(o);
                }
            }
            return outbreaks;
        } catch (Exception e) {
            log.error("Failed to fetch outbreaks from Python API: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    @GetMapping("/diseases")
    public ResponseEntity<List<CattleOutbreak>> getDiseases() {
        return ResponseEntity.ok(fetchOutbreaksFromPythonService());
    }

    @GetMapping("/birds/sightings")
    public ResponseEntity<List<BirdSighting>> getBirdSightings() {
        return ResponseEntity.ok(birdSightingService.getAllSightings());
    }

    @PostMapping("/birds/sightings")
    public ResponseEntity<BirdSighting> addBirdSighting(@RequestBody BirdSighting sighting) {
        log.info("Received new bird sighting to record: {}", sighting.getName());
        BirdSighting saved = birdSightingService.saveSighting(sighting);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/birds/stats")
    public ResponseEntity<List<Map<String, Object>>> getBirdStats() {
        return ResponseEntity.ok(birdSightingService.getPopulationSummary());
    }

    @PostMapping(value = "/birds/classify", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> classifyBirdSound(@RequestParam("file") MultipartFile file) {
        log.info("Forwarding bird sound audio file for classification...");
        try {
            String url = pythonServiceUrl + "/classify-bird";
            
            // Build multipart request header & body for REST call
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };
            body.add("file", fileResource);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            
            // Call Python service
            ResponseEntity<Map> response = restTemplate.postForEntity(url, requestEntity, Map.class);
            return ResponseEntity.ok(response.getBody());

        } catch (Exception e) {
            log.error("Failed to classify bird sound: {}", e.getMessage());
            Map<String, String> err = new HashMap<>();
            err.put("error", "Classification service is currently offline: " + e.getMessage());
            return ResponseEntity.status(503).body(err);
        }
    }

    @PostMapping("/sync/trigger")
    public ResponseEntity<Map<String, String>> triggerManualSync() {
        log.info("Manual synchronization triggered by API call.");
        Map<String, String> response = new HashMap<>();
        try {
            dataSyncService.syncAllData();
            response.put("status", "success");
            response.put("message", "Commodity prices and cattle disease data successfully synchronized.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Manual sync failed: {}", e.getMessage());
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
}
