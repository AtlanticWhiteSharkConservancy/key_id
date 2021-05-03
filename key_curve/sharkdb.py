import logging
import numpy as np
import sqlite3


class SharkDB():
    def __init__(self):
        self.conn = sqlite3.connect('/data/keycurve.db')
        self.cursor = self.conn.cursor()
        self.upsert_table()


    def upsert_table(self):
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        table_found = False
        for table in self.cursor.fetchall():
            if table[0] == "keycurves":
                table_found = True
                break
        if not table_found:
            self.cursor.execute('''CREATE TABLE keycurves
                                    (name text, sex text, sourceimage text, keycurve text)''')
            self.conn.commit()
            logging.info("Created keycurves table as it was not found.  Assuming this is a new database.")


    def store_key_curve(self, name, keycurve, sourceimage,  sex=None):
        if isinstance(keycurve, list):
            keycurve = ','.join([str(x) for x in keycurve])
        self.cursor.execute('INSERT INTO keycurves VALUES (?, ?, ?, ?)', (name, sex, sourceimage, keycurve))
        self.conn.commit()


    def get_all_records(self):
        self.cursor.execute('SELECT name, sex, sourceimage FROM keycurves')
        return self.cursor.fetchall()


    def match_curve(self, match_curve, max=3, sex=None):
        self.cursor.execute('SELECT * FROM keycurves')
        stored_records = self.cursor.fetchall()
        key_curves = {}
        for record in stored_records:
            if sex and record[1] is not None:
                continue
            curve = [ int(x) for x in record[3].split(',') ]
            sourceimage = record[2]
            key_curves[record[0]] = { 'curve_delta': np.absolute(np.array(curve) - np.array(match_curve)).sum(),
                                      'sourceimage': sourceimage
                                      }
        sorted_results = sorted(key_curves.items(), key=lambda x: x[1]['sourceimage'])
        return [ (x[0],x[1]['sourceimage']) for x in sorted_results[:max - 1] ]


    def clear_video_labels(self, s3_url):
        base_path = s3_url.strip('.MP4')
        self.cursor.execute("SELECT COUNT(*) FROM keycurves WHERE sourceimage LIKE ?", (base_path + '%',))
        deleted = self.cursor.fetchall()[0][0]
        self.cursor.execute("DELETE FROM keycurves WHERE sourceimage LIKE ?", (base_path + '%',))
        self.conn.commit()
        return deleted




