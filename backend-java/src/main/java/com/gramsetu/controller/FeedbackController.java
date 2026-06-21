package com.gramsetu.controller;

import com.gramsetu.model.Feedback;
import com.gramsetu.repository.FeedbackRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/feedback")
@CrossOrigin
public class FeedbackController {

    private final FeedbackRepository feedbackRepository;

    @Autowired
    public FeedbackController(FeedbackRepository feedbackRepository) {
        this.feedbackRepository = feedbackRepository;
    }

    @PostMapping
    public Feedback submitFeedback(@RequestBody Feedback feedback) {
        if (feedback.getTimestamp() == null || feedback.getTimestamp().isEmpty()) {
            feedback.setTimestamp(new SimpleDateFormat("yyyy-MM-dd hh:mm:ss a").format(new Date()));
        }
        return feedbackRepository.save(feedback);
    }

    @GetMapping
    public List<Feedback> getAllFeedback() {
        return feedbackRepository.findAll(Sort.by(Sort.Direction.DESC, "id"));
    }
}
