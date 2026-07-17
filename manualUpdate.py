import csv
import boto3
from botocore.exceptions import ClientError

# --- Configuration ---
TSV_FILE_PATH = 'updatePB.txt'       # Your local TSV file name
TABLE_NAME = 'pb-run-HistoryPB'       # Your exact live table name
AWS_REGION = 'us-east-1'               # Replace with your actual AWS table region

# Initialize the native DynamoDB client targeting AWS directly
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)

def process_and_upload_tsv(input_path):
    print(f"Connecting to AWS DynamoDB table: {TABLE_NAME}...")
    success_count = 0
    
    with open(input_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        
        for index, row in enumerate(reader, start=1):
            # Extract and clean values safely into strings
            wexin_id = str(row.get('wexinID', '')).strip()
            count_val = str(row.get('count', '')).strip()
            pb_time = str(row.get('PBTime', '')).strip()
            pb_date = str(row.get('PBDate', '')).strip()
            row_type = str(row.get('type', '')).strip()

            if not wexin_id:
                print(f"⚠️ Row {index} skipped: Missing Partition Key (wexinID).")
                continue

            try:
                # CASE 1: Type is 'New' -> Create completely fresh item (INSERT replacement)
                if row_type == 'New!':
                    table.put_item(
                        Item={
                            'wexinID': wexin_id,
                            'count': count_val,
                            'PBTime': pb_time,
                            'PBDate': pb_date
                        }
                    )
                
                # CASE 2: Type is 'PB' -> Natively update 3 attributes
                elif row_type == 'PB!':
                    table.update_item(
                        Key={'wexinID': wexin_id},
                        UpdateExpression="SET #c = :count, #t = :time, #d = :date",
                        ExpressionAttributeNames={
                            '#c': 'count',
                            '#t': 'PBTime',
                            '#d': 'PBDate'

                        },
                        ExpressionAttributeValues={
                            ':count': count_val,
                            ':time': pb_time,
                            ':date': pb_date

                        }
                    )
                
                # CASE 3: Type is empty -> Only update the count attribute
                elif not row_type:
                    table.update_item(
                        Key={'wexinID': wexin_id},
                        UpdateExpression="SET #c = :count",
                        ExpressionAttributeNames={
                            '#c': 'count'
                        },
                        ExpressionAttributeValues={
                            ':count': count_val
                        }
                    )
                else:
                    continue

                print(f"✅ Row {index} processed successfully for user: {wexin_id}")
                success_count += 1

            except ClientError as e:
                print(f"❌ Error updating row {index} ({wexin_id}): {e.response['Error']['Message']}")

    print(f"\nFinished processing! Natively uploaded {success_count} rows to DynamoDB.")

if __name__ == '__main__':
    # Ensure you have run 'aws configure' on your machine beforehand
    process_and_upload_tsv(TSV_FILE_PATH)