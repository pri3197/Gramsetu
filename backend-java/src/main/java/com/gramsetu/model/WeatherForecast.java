package com.gramsetu.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "weather_forecasts")
public class WeatherForecast {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String region;
    private Double currentTemp;
    private String forecast;
    private String elNinoStatus;
    private String elNinoImpact;
    private Double anomalyIndex;

    // Constructors
    public WeatherForecast() {
    }

    public WeatherForecast(Long id, String region, Double currentTemp, String forecast, 
                           String elNinoStatus, String elNinoImpact, Double anomalyIndex) {
        this.id = id;
        this.region = region;
        this.currentTemp = currentTemp;
        this.forecast = forecast;
        this.elNinoStatus = elNinoStatus;
        this.elNinoImpact = elNinoImpact;
        this.anomalyIndex = anomalyIndex;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public Double getCurrentTemp() {
        return currentTemp;
    }

    public void setCurrentTemp(Double currentTemp) {
        this.currentTemp = currentTemp;
    }

    public String getForecast() {
        return forecast;
    }

    public void setForecast(String forecast) {
        this.forecast = forecast;
    }

    public String getElNinoStatus() {
        return elNinoStatus;
    }

    public void setElNinoStatus(String elNinoStatus) {
        this.elNinoStatus = elNinoStatus;
    }

    public String getElNinoImpact() {
        return elNinoImpact;
    }

    public void setElNinoImpact(String elNinoImpact) {
        this.elNinoImpact = elNinoImpact;
    }

    public Double getAnomalyIndex() {
        return anomalyIndex;
    }

    public void setAnomalyIndex(Double anomalyIndex) {
        this.anomalyIndex = anomalyIndex;
    }
}
