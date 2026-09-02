import asyncio
import sys
from backend.jobs import JobManager
from backend.db import init_mongodb, get_collection

async def test_admission_control():
    print("Starting Admission Control Test...")
    await init_mongodb()
    col = get_collection('marketplace_pdf_jobs')
    await col.delete_many({})
    
    JobManager.MAX_CONCURRENT_JOBS = 1
    print(f"Set MAX_CONCURRENT_JOBS to {JobManager.MAX_CONCURRENT_JOBS}")
    
    # Create two jobs
    await JobManager.create_job('prod_1')
    await JobManager.create_job('prod_2')
    print("Created 2 jobs (prod_1, prod_2) in 'queued' state")
    
    # Try to admit first job
    j1 = await JobManager.try_admit_job()
    print(f"Job 1 Admission: {j1.status if j1 else 'Failed'} (ID: {j1.id if j1 else 'N/A'})")
    
    # Try to admit second job (should fail because limit is 1)
    j2 = await JobManager.try_admit_job()
    print(f"Job 2 Admission: {j2.status if j2 else 'Blocked (Correct)'}")
    
    if j1 and not j2:
        print("Initial admission control: OK")
    else:
        print("Initial admission control: FAILED")
        sys.exit(1)
        
    # Finish first job
    await JobManager.update_job_status(j1.id, 'done')
    print(f"Job 1 marked as 'done'")
    
    # Now second job should be admitted
    j2_retry = await JobManager.try_admit_job()
    print(f"Job 2 Retry Admission: {j2_retry.status if j2_retry else 'Failed'}")
    
    if j2_retry and j2_retry.product_id == 'prod_2':
        print("✅ Admission Control Verified successfully!")
    else:
        print("❌ Admission Control Verification FAILED")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_admission_control())
