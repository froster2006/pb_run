import json
import boto3
from decimal import Decimal



def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError


dynamodb = boto3.resource("dynamodb")
TABLE_NAME = "pb-run-HistoryPB"
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):

    try:
        # API Gateway sends JSON body
        body = json.loads(event.get("body", "{}"))

        wexinID = body.get("wexinID")
        count = body.get("count")
        PBTime = body.get("PBTime")
        PBDate = body.get("PBDate")

        if not wexinID:
            return response(
                400,
                {"error": "Missing wexinID"}
            )

        # Update DynamoDB
        result = table.update_item(
            Key={
                "wexinID": wexinID
            },
            UpdateExpression="""
                SET #cnt = :count,
                    PBTime = :pbtime,
                    PBDate = :pbdate
            """,
            ExpressionAttributeNames={
                "#cnt": "count"
            },
            ExpressionAttributeValues={
                ":count": count,
                ":pbtime": PBTime,
                ":pbdate": PBDate
            },
            ReturnValues="ALL_NEW"
        )

        return response(
            200,
            {
                "message": "Update successful",
                "item": result.get("Attributes")
            }
        )

    except Exception as e:
        return response(
            500,
            {
                "error": str(e)
            }
        )


def response(status_code, body):

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        "body": json.dumps(
            body,
            ensure_ascii=False,
            default=decimal_default
        )
    }