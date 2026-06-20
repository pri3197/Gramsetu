package com.gramsetu.repository;

import com.gramsetu.model.GroundwaterRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroundwaterRecordRepository extends JpaRepository<GroundwaterRecord, Long> {
}
