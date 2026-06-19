package com.gramsetu.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "bird_sightings")
public class BirdSighting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String birdId;
    private String name;
    private String scientificName;
    private String status;
    private String description;
    
    private Double latitude;
    private Double longitude;
    
    private LocalDateTime timestamp;
    private Double confidence;
    private Boolean isEndangered;

    // Constructors
    public BirdSighting() {
    }

    public BirdSighting(Long id, String birdId, String name, String scientificName, String status, String description, 
                        Double latitude, Double longitude, LocalDateTime timestamp, Double confidence, Boolean isEndangered) {
        this.id = id;
        this.birdId = birdId;
        this.name = name;
        this.scientificName = scientificName;
        this.status = status;
        this.description = description;
        this.latitude = latitude;
        this.longitude = longitude;
        this.timestamp = timestamp;
        this.confidence = confidence;
        this.isEndangered = isEndangered;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getBirdId() {
        return birdId;
    }

    public void setBirdId(String birdId) {
        this.birdId = birdId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getScientificName() {
        return scientificName;
    }

    public void setScientificName(String scientificName) {
        this.scientificName = scientificName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public Boolean getIsEndangered() {
        return isEndangered;
    }

    public void setIsEndangered(Boolean isEndangered) {
        this.isEndangered = isEndangered;
    }
}
