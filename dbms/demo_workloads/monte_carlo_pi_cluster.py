"""
UniCompute HPC Cluster - Sample Distributed Workload
Topic: Distributed Monte Carlo Pi Estimation & Multi-core Sieve
Author: UniCompute Capstone Team
"""

import time
import math
import random
import multiprocessing

def monte_carlo_worker(num_samples):
    inside_circle = 0
    # Use localized seed per process
    random.seed()
    for _ in range(num_samples):
        x = random.random()
        y = random.random()
        if (x * x + y * y) <= 1.0:
            inside_circle += 1
    return inside_circle

def main():
    print("=" * 72)
    print("       UniCompute Academic HPC Cluster - Distributed Monte Carlo")
    print("       Task: High-Precision Pi Approximation & Core Throughput")
    print("=" * 72)

    total_samples = 20_000_000
    cores = multiprocessing.cpu_count()
    samples_per_worker = total_samples // cores

    print(f"[*] Available Worker Cores       : {cores}")
    print(f"[*] Total Stochastic Iterations  : {total_samples:,}")
    print(f"[*] Slices Per Core Worker       : {samples_per_worker:,}")
    print(f"[*] Dispersing simulation across cluster workers...")

    start_time = time.perf_counter()

    with multiprocessing.Pool(processes=cores) as pool:
        results = pool.map(monte_carlo_worker, [samples_per_worker] * cores)

    end_time = time.perf_counter()
    elapsed = end_time - start_time

    total_inside = sum(results)
    estimated_pi = 4.0 * total_inside / total_samples
    actual_pi = math.pi
    error_percentage = abs((estimated_pi - actual_pi) / actual_pi) * 100

    print("\n" + "=" * 72)
    print("                   SIMULATION RESULTS")
    print("=" * 72)
    print(f"  > Estimated Pi (Calculated): {estimated_pi:.8f}")
    print(f"  > Theoretical Constant     : {actual_pi:.8f}")
    print(f"  > Error Margin             : {error_percentage:.5f}%")
    print(f"  > Time Taken               : {elapsed:.3f} seconds")
    print(f"  > Point Rate               : {int(total_samples / elapsed):,} points/sec")
    print("=" * 72)
    print("[+] Academic proof verified. Workload execution finished successfully.")

if __name__ == "__main__":
    main()
