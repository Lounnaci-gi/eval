from dbfread import DBF
import pandas as pd

def explore(path):
    print(f"--- Exploring {path} ---")
    try:
        table = DBF(path, load=False)
        print("Fields:")
        for field in table.fields:
            print(f"  {field.name} ({field.type})")
        
        # Load a few records
        count = 0
        for record in table:
            print("First record:", record)
            break
    except Exception as e:
        print(f"Error: {e}")

explore(r'd:\epeor\ABONNE.DBF')
explore(r'd:\epeor\FACTURES.DBF')
