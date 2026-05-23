import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'epeor-analytics', 'backend')))
import main

main.load_all_data_to_memory()

print("Checking signs of MONTTC in MEM_AVOIRS:")
positive_count = 0
negative_count = 0
zero_count = 0
sample_positives = []
sample_negatives = []

for r in main.MEM_AVOIRS:
    monttc = float(r.get('MONTTC') or 0)
    if monttc > 0:
        positive_count += 1
        if len(sample_positives) < 5:
            sample_positives.append(monttc)
    elif monttc < 0:
        negative_count += 1
        if len(sample_negatives) < 5:
            sample_negatives.append(monttc)
    else:
        zero_count += 1

print(f"Positives: {positive_count}, Negatives: {negative_count}, Zeros: {zero_count}")
print("Sample positives:", sample_positives)
print("Sample negatives:", sample_negatives)
