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
     * Automatic weekly update for Mandi/agricultural commodity prices.
     * Fires every Monday at 1:00 AM.
     */
    @Scheduled(cron = "0 0 1 * * MON")
    public void scheduleWeeklyPriceUpdate() {
        log.info("Starting automated weekly commodity prices synchronization...");
        try {
            dataSyncService.syncCommodityPrices();
            log.info("Automated weekly commodity prices sync completed successfully.");
        } catch (Exception e) {
            log.error("Failed automated weekly commodity prices sync: {}", e.getMessage());
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
}
