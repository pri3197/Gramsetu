package com.gramsetu.controller;

import com.gramsetu.model.NewsArticle;
import com.gramsetu.repository.NewsArticleRepository;
import com.gramsetu.service.DataSyncService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/news")
public class NewsController {

    private static final Logger log = LoggerFactory.getLogger(NewsController.class);

    @Autowired
    private NewsArticleRepository newsRepository;

    @Autowired
    private DataSyncService dataSyncService;

    @GetMapping
    public ResponseEntity<List<NewsArticle>> getNews(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String topic) {
        
        log.info("Fetching news articles. Category: {}, Topic: {}", category, topic);
        List<NewsArticle> articles = newsRepository.findAll();
        
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
        log.info("Manual news synchronization triggered via REST API");
        Map<String, String> response = new HashMap<>();
        try {
            dataSyncService.syncNewsArticles();
            response.put("status", "success");
            response.put("message", "News synchronization completed successfully.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to sync news articles: {}", e.getMessage());
            response.put("status", "error");
            response.put("message", "Failed to sync news: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
}
