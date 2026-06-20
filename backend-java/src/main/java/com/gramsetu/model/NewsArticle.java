package com.gramsetu.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "news_articles")
public class NewsArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    @Column(length = 2000)
    private String summary;

    private String source;
    private String url;
    private String publishDate;
    private String category; // "Agriculture" or "Fishery"
    private String topic;    // "Modern Farming", "Bio Farming", "New Fishing Ways", "Oil Spills", "Climate Change", "Trending"
    private String outletType; // "Indian" or "Foreign"

    // Constructors
    public NewsArticle() {
    }

    public NewsArticle(Long id, String title, String summary, String source, String url, 
                       String publishDate, String category, String topic, String outletType) {
        this.id = id;
        this.title = title;
        this.summary = summary;
        this.source = source;
        this.url = url;
        this.publishDate = publishDate;
        this.category = category;
        this.topic = topic;
        this.outletType = outletType;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getPublishDate() {
        return publishDate;
    }

    public void setPublishDate(String publishDate) {
        this.publishDate = publishDate;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public String getOutletType() {
        return outletType;
    }

    public void setOutletType(String outletType) {
        this.outletType = outletType;
    }
}
