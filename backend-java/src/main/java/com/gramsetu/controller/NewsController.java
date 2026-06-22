package com.gramsetu.controller;

import com.gramsetu.model.NewsArticle;
import com.gramsetu.repository.NewsArticleRepository;
import com.gramsetu.service.DataSyncService;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/news")
public class NewsController {

    private static final Logger log = LoggerFactory.getLogger(NewsController.class);

    @Value("${gramsetu.python.service.url}")
    private String pythonServiceUrl;

    @Autowired
    private NewsArticleRepository newsRepository;

    @Autowired
    private DataSyncService dataSyncService;

    private final RestTemplate restTemplate = new RestTemplate();

    private List<NewsArticle> fetchNewsFromPythonService() {
        try {
            String url = pythonServiceUrl + "/news";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            List<NewsArticle> articles = new ArrayList<>();
            if (response != null && response.containsKey("data")) {
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get("data");
                long idCounter = 1;
                for (Map<String, Object> r : records) {
                    NewsArticle a = new NewsArticle();
                    a.setId(idCounter++);
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
            }
            return articles;
        } catch (Exception e) {
            log.error("Failed to fetch news articles from Python API: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    @GetMapping
    public ResponseEntity<List<NewsArticle>> getNews(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String topic) {
        
        log.info("Fetching news articles from Python service. Category: {}, Topic: {}", category, topic);
        List<NewsArticle> articles = fetchNewsFromPythonService();
        
        if (category != null && !category.isEmpty() && !"all".equalsIgnoreCase(category)) {
            articles = articles.stream()
                    .filter(a -> category.equalsIgnoreCase(a.getCategory()))
                    .collect(Collectors.toList());
        }
        
        if (topic != null && !topic.isEmpty() && !"all".equalsIgnoreCase(topic)) {
            articles = articles.stream()
                    .filter(a -> topic.equalsIgnoreCase(a.getTopic()))
                    .collect(Collectors.toList());
        }
        
        // Return latest news first by sorting descending by ID (which aligns with sequential insertion/dates)
        articles.sort((a, b) -> b.getId().compareTo(a.getId()));
        
        return ResponseEntity.ok(articles);
    }

    @PostMapping("/sync")
    public ResponseEntity<?> triggerNewsSync() {
        log.info("Manual news synchronization triggered via REST API - Bypassed for real-time mode");
        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "News is loaded dynamically in real-time from the Python service.");
        return ResponseEntity.ok(response);
    }
}
