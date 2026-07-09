import sys
sys.path.append(r'D:\eval\epeor-analytics')
import backend.main as m

print('MEM_ABONNES count:', len(getattr(m,'MEM_ABONNES',[])))
print('MEM_ABONMENTS count:', len(getattr(m,'MEM_ABONMENTS',[])))
try:
    s = m.compute_dashboard_stats()
    print('forfait_subscribers:', s.get('forfait_subscribers'))
    com_sum = sum((c.get('forfait_count') or 0) for c in s.get('subscriber_communes',[]))
    typ_sum = sum((t.get('forfait_count') or 0) for t in s.get('subscriber_types',[]))
    print('sum communes forfait_count:', com_sum)
    print('sum types forfait_count:', typ_sum)
except Exception as e:
    print('error computing stats:', e)
