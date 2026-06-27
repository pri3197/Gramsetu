package com.gramsetu.controller;

import com.gramsetu.model.GroundwaterRecord;
import com.gramsetu.repository.GroundwaterRecordRepository;
import com.gramsetu.model.WeatherForecast;
import com.gramsetu.repository.WeatherForecastRepository;
import java.util.ArrayList;
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

    private final RestTemplate restTemplate = new RestTemplate();

    private List<WeatherForecast> fetchWeatherFromPythonService() {
        try {
            String url = pythonServiceUrl + "/weather/forecast";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            List<WeatherForecast> forecasts = new ArrayList<>();
            if (response != null && response.containsKey("data")) {
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get("data");
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
            }
            return forecasts;
        } catch (Exception e) {
            log.error("Failed to fetch weather forecasts from Python API: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    @GetMapping("/forecast")
    public ResponseEntity<List<WeatherForecast>> getWeatherForecast() {
        log.info("Fetching regional weather forecasts from Python service");
        return ResponseEntity.ok(fetchWeatherFromPythonService());
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

        return ResponseEntity.ok(List.of());
    }
}
