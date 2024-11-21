import auxiliary
import datetime
import dateparser

print(auxiliary.parseDateTime("I have a meeting from 2 PM to 4 PM next Monday"))

import dateparser

# Parse "next Monday" from the current date
parsed_date = dateparser.parse("next Thursday", settings={
    'RELATIVE_BASE': datetime.datetime.now(),
    'PREFER_DATES_FROM': 'future'
})
print("Parsed date:", parsed_date)