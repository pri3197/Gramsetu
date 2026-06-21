package com.gramsetu.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;

@Entity
@Table(name = "feedback")
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String category; // recommendation, review, complaint, idea
    private String senderHandle;
    private Integer rating; // 1 to 5
    @Column(length = 1000)
    private String content;
    private String timestamp;

    public Feedback() {
    }

    public Feedback(Long id, String category, String senderHandle, Integer rating, String content, String timestamp) {
        this.id = id;
        this.category = category;
        this.senderHandle = senderHandle;
        this.rating = rating;
        this.content = content;
        this.timestamp = timestamp;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getSenderHandle() {
        return senderHandle;
    }

    public void setSenderHandle(String senderHandle) {
        this.senderHandle = senderHandle;
    }

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }
}
