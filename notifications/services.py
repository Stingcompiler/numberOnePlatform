import requests
import logging
from .models import ExpoPushToken, Notification

logger = logging.getLogger(__name__)

EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send'

def send_expo_push_notification(tokens, title, message, data=None):
    """
    Sends a push notification to multiple Expo push tokens.
    """
    if not tokens:
        return

    if data is None:
        data = {}

    headers = {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
    }

    # Format the payload as required by Expo
    payload = []
    for token in tokens:
        payload.append({
            'to': token,
            'sound': 'default',
            'title': title,
            'body': message,
            'data': data,
            'badge': 1,
        })

    try:
        response = requests.post(EXPO_PUSH_API_URL, headers=headers, json=payload, timeout=10)
        response_data = response.json()
        
        # Handle errors and invalid tokens
        if 'data' in response_data:
            for idx, res in enumerate(response_data['data']):
                if res.get('status') == 'error':
                    details = res.get('details', {})
                    error_code = details.get('error')
                    if error_code in ['DeviceNotRegistered', 'InvalidCredentials']:
                        # The token is no longer valid, we should delete it
                        invalid_token = payload[idx]['to']
                        ExpoPushToken.objects.filter(token=invalid_token).delete()
                        logger.info(f"Deleted invalid Expo token: {invalid_token}")
                    else:
                        logger.error(f"Expo push error: {res.get('message')}")
    except Exception as e:
        logger.error(f"Failed to send Expo push notification: {str(e)}")

def create_and_send_notification(students, title, message, notification_type, related_object_id=None):
    """
    Creates Notification records in the database and sends Expo push notifications to the students.
    `students` can be a single StudentProfile or an iterable of StudentProfiles.
    """
    try:
        iter(students)
    except TypeError:
        students = [students]

    notifications_to_create = []
    tokens_to_send = []

    for student in students:
        notifications_to_create.append(Notification(
            student=student,
            title=title,
            message=message,
            notification_type=notification_type,
            related_object_id=str(related_object_id) if related_object_id else None
        ))
        # Gather tokens
        tokens = student.expo_push_tokens.values_list('token', flat=True)
        tokens_to_send.extend(tokens)

    # Bulk create notifications in DB
    if notifications_to_create:
        Notification.objects.bulk_create(notifications_to_create)

    # Send push notifications
    if tokens_to_send:
        data = {
            'type': notification_type,
            'related_object_id': str(related_object_id) if related_object_id else None
        }
        send_expo_push_notification(tokens_to_send, title, message, data)
