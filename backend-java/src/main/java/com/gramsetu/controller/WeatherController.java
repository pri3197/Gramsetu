package com.gramsetu.controller;

import com.gramsetu.model.GroundwaterRecord;
import com.gramsetu.repository.GroundwaterRecordRepository;
import com.gramsetu.model.WeatherForecast;
import com.gramsetu.repository.WeatherForecastRepository;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private static final Logger log = LoggerFactory.getLogger(WeatherController.class);

    @Value("${gramsetu.python.service.url}")
    private String pythonServiceUrl;

    @Autowired
    private WeatherForecastRepository weatherRepository;

    @Autowired
    private GroundwaterRecordRepository groundwaterRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/groundwater")
    public ResponseEntity<List<GroundwaterRecord>> getGroundwaterRecords() {
        log.info("Fetching groundwater records from database");
        return ResponseEntity.ok(groundwaterRepository.findAll());
    }

    @GetMapping("/forecast")
    public ResponseEntity<List<WeatherForecast>> getWeatherForecast() {
        log.info("Fetching regional weather forecasts from database");
        return ResponseEntity.ok(weatherRepository.findAll());
    }

    @GetMapping("/climate-trends")
    public ResponseEntity<?> getClimateTrends() {
        log.info("Fetching climate trends from Python service: {}/weather/trends", pythonServiceUrl);
        try {
            String url = pythonServiceUrl + "/weather/trends";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                return ResponseEntity.ok(response.get("data"));
            }
        } catch (Exception e) {
            log.error("Could not fetch climate trends from Python service: {}", e.getMessage());
        }
        
        // Return a mock fallback trend dataset if the Python service is offline
        return ResponseEntity.ok(getFallbackClimateTrends());
    }

    private List<Map<String, Object>> getFallbackClimateTrends() {
        return List.of(
            Map.of("year", 2000, "temp_anomaly", 0.22, "rainfall_deviation", 5.0),
            Map.of("year", 2005, "temp_anomaly", 0.39, "rainfall_deviation", 1.0),
            Map.of("year", 2010, "temp_anomaly", 0.60, "rainfall_deviation", 9.0),
            Map.of("year", 2015, "temp_anomaly", 0.74, "rainfall_deviation", -14.0),
            Map.of("year", 2020, "temp_anomaly", 0.72, "rainfall_deviation", 9.0),
            Map.of("year", 2023, "temp_anomaly", 1.12, "rainfall_deviation", -8.0),
            Map.of("year", 2026, "temp_anomaly", 1.15, "rainfall_deviation", -6.0)
        );
    }
}
