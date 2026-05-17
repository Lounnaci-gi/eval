import time
import os
import pickle
from dbfread import DBF

# 1. Load from DBF
t0 = time.time()
print("Loading DBF...")
dbf = DBF('d:/epeor/FACTURES.DBF', load=True, encoding='cp1256')
records = [dict(r) for r in dbf]  # Convert to standard dict for better serialization
print(f"Loaded {len(records)} records in {time.time()-t0:.2f}s")

# 2. Save to pickle
t1 = time.time()
print("Saving pickle...")
cache_dir = 'd:/eval/epeor-analytics/backend/cache'
os.makedirs(cache_dir, exist_ok=True)
pickle_path = os.path.join(cache_dir, 'factures.pkl')
with open(pickle_path, 'wb') as f:
    pickle.dump(records, f, protocol=pickle.HIGHEST_PROTOCOL)
print(f"Saved pickle in {time.time()-t1:.2f}s")

# 3. Load from pickle
t2 = time.time()
print("Loading pickle...")
with open(pickle_path, 'rb') as f:
    loaded_records = pickle.load(f)
print(f"Loaded {len(loaded_records)} records from pickle in {time.time()-t2:.2f}s")
