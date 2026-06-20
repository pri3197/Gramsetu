package com.gramsetu.scheduler;

import com.gramsetu.service.DataSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class DataUpdateScheduler {

    private static final Logger log = LoggerFactory.getLogger(DataUpdateScheduler.class);

    @Autowired
    private DataSyncService dataSyncService;

    /**
     * Automatic daily update for Mandi/agricultural commodity prices.
     * Fires every day at 1:00 AM.
     */
    @Scheduled(cron = "0 0 1 * * *")
    public void scheduleDailyPriceUpdate() {
        log.info("Starting automated daily commodity prices synchronization...");
        try {
            dataSyncService.syncCommodityPrices();
            log.info("Automated daily commodity prices sync completed successfully.");
        } catch (Exception e) {
            log.error("Failed automated daily commodity prices sync: {}", e.getMessage());
        }
    }

    /**
     * Automatic monthly update for Cattle disease outbreaks.
     * Fires at 2:00 AM on the 1st of every month.
     */
    @Scheduled(cron = "0 0 2 1 * *")
    public void scheduleMonthlyOutbreaksUpdate() {
        log.info("Starting automated monthly cattle disease outbreaks synchronization...");
        try {
            dataSyncService.syncCattleOutbreaks();
            log.info("Automated monthly disease outbreaks sync completed successfully.");
        } catch (Exception e) {
            log.error("Failed automated monthly disease outbreaks sync: {}", e.getMessage());
        }
    }

    /**
     * Automatic daily update for news articles.
     * Fires every day at 3:00 AM.
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void scheduleDailyNewsUpdate() {
        log.info("Starting automated daily news articles synchronization...");
        try {
            dataSyncService.syncNewsArticles();
            log.info("Automated daily news articles sync completed successfully.");
        } catch (Exception e) {
            log.error("Failed automated daily news articles sync: {}", e.getMessage());
        }
    }
}
