package com.gramsetu.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "cattle_outbreaks")
public class CattleOutbreak {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String state;
    private String district;
    private String disease;
    private Double latitude;
    private Double longitude;
    private Integer activeCases;
    private String severity;
    private String transmission;
    private String reportDate;
    
    // Store as comma-separated values (e.g., "Lumpy-Provac, Goat Pox Vaccine")
    private String recommendedVaccines;

    // Constructors
    public CattleOutbreak() {
    }

    public CattleOutbreak(Long id, String state, String district, String disease, Double latitude, Double longitude, 
                          Integer activeCases, String severity, String transmission, String reportDate, String recommendedVaccines) {
        this.id = id;
        this.state = state;
        this.district = district;
        this.disease = disease;
        this.latitude = latitude;
        this.longitude = longitude;
        this.activeCases = activeCases;
        this.severity = severity;
        this.transmission = transmission;
        this.reportDate = reportDate;
        this.recommendedVaccines = recommendedVaccines;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    public String getDisease() {
        return disease;
    }

    public void setDisease(String disease) {
        this.disease = disease;
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

    public Integer getActiveCases() {
        return activeCases;
    }

    public void setActiveCases(Integer activeCases) {
        this.activeCases = activeCases;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getTransmission() {
        return transmission;
    }

    public void setTransmission(String transmission) {
        this.transmission = transmission;
    }

    public String getReportDate() {
        return reportDate;
    }

    public void setReportDate(String reportDate) {
        this.reportDate = reportDate;
    }

    public String getRecommendedVaccines() {
        return recommendedVaccines;
    }

    public void setRecommendedVaccines(String recommendedVaccines) {
        this.recommendedVaccines = recommendedVaccines;
    }
}
