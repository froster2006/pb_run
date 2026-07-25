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

    if isinstance(event, str):
        try:
            event = json.loads(event)
        except json.JSONDecodeError:
            event = {}
    elif not isinstance(event, dict):
        event = {}

    http_method = event.get("httpMethod")
    if not http_method:
        request_context = event.get("requestContext") or {}
        http_info = request_context.get("http") or {}
        http_method = http_info.get("method")

    if http_method == "OPTIONS":
        return response(200, {"message": "OK"})

    try:
        raw_body = event.get("body") or "{}"
        if isinstance(raw_body, str):
            parsed_body = json.loads(raw_body)
        else:
            parsed_body = raw_body or {}

        if isinstance(parsed_body, dict) and "body" in parsed_body:
            inner_body = parsed_body.get("body")
            if isinstance(inner_body, str):
                try:
                    parsed_body = json.loads(inner_body)
                except json.JSONDecodeError:
                    parsed_body = inner_body
            else:
                parsed_body = inner_body

        if isinstance(parsed_body, list):
            items = parsed_body
        elif isinstance(parsed_body, dict):
            items = [parsed_body]
        else:
            return response(400, {"error": "Request body must be an object or an array"})

        if not items:
            return response(400, {"error": "No items provided"})

        updated_items = []
        for item in items:
            if not isinstance(item, dict):
                continue

            wexinID = item.get("wexinID")
            count = item.get("count")
            PBTime = item.get("PBTime")
            PBDate = item.get("PBDate")
            item_type = item.get("type")

            if not wexinID:
                continue

            if item_type == "New!":
                result = table.put_item(
                    Item={
                        "wexinID": wexinID,
                        "count": count,
                        "PBTime": PBTime,
                        "PBDate": PBDate
                    }
                )
                updated_items.append({"wexinID": wexinID, "count": count, "PBTime": PBTime, "PBDate": PBDate})
                continue

            if item_type == "PB!" or item_type == "single":
                result = table.update_item(
                    Key={"wexinID": wexinID},
                    UpdateExpression="SET #c = :count, #t = :time, #d = :date",
                    ExpressionAttributeNames={
                        "#c": "count",
                        "#t": "PBTime",
                        "#d": "PBDate"
                    },
                    ExpressionAttributeValues={
                        ":count": count,
                        ":time": PBTime,
                        ":date": PBDate
                    },
                    ReturnValues="ALL_NEW"
                )
                updated_items.append(result.get("Attributes", {}))
                continue

            if not item_type:
                result = table.update_item(
                    Key={"wexinID": wexinID},
                    UpdateExpression="SET #c = :count",
                    ExpressionAttributeNames={"#c": "count"},
                    ExpressionAttributeValues={":count": count},
                    ReturnValues="ALL_NEW"
                )
                updated_items.append(result.get("Attributes", {}))
                continue

            updated_items.append({"wexinID": wexinID, "skipped": True, "reason": "unsupported type"})

        return response(
            200,
            {
                "message": "Update successful",
                "updatedCount": len(updated_items)
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
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key,X-Amz-Date,Accept"
        },
        "body": json.dumps(
            body,
            ensure_ascii=False,
            default=decimal_default
        )
    }