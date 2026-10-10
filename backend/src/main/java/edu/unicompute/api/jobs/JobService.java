package edu.unicompute.api.jobs;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

@Service
public class JobService {

    private final Map<UUID, Job> jobs = new ConcurrentHashMap<>();

    public Job submit(JobSubmissionRequest request) {
        UUID jobId = UUID.randomUUID();

        Job job = new Job(
                jobId,
                request.jobName(),
                request.language(),
                request.cpuCores(),
                request.memoryMb(),
                request.storageMb(),
                request.maxExecutionTimeSeconds(),
                request.priority(),
                request.schedulingAlgorithm(),
                "QUEUED",
                Instant.now()
        );

        jobs.put(jobId, job);
        return job;
    }

    public List<Job> findAll() {
        return jobs.values().stream()
                .sorted(Comparator.comparing(Job::submittedAt).thenComparing(Job::jobId))
                .toList();
    }

    public Optional<Job> findById(UUID jobId) {
        return Optional.ofNullable(jobs.get(jobId));
    }
}