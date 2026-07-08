from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Notification, ExpoPushToken
from .serializers import NotificationSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_push_token(request):
    """
    Register or update an Expo Push Token for the logged-in student.
    Expected payload:
    {
        "token": "ExponentPushToken[...]",
        "device_id": "optional-device-id"
    }
    """
    student_profile = getattr(request.user, 'student_profile', None)
    if not student_profile:
        return Response({'error': 'User is not a student.'}, status=status.HTTP_403_FORBIDDEN)

    token = request.data.get('token')
    device_id = request.data.get('device_id', '')

    if not token:
        return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate that it looks like an Expo token (optional but good practice)
    if not str(token).startswith('ExponentPushToken['):
        pass # Expo tokens might also look like ExponentPushToken[...] or ExpoPushToken[...]

    # Update or create the token
    obj, created = ExpoPushToken.objects.update_or_create(
        token=token,
        defaults={
            'student': student_profile,
            'device_id': device_id
        }
    )

    return Response({'message': 'Token registered successfully.'}, status=status.HTTP_200_OK)


class NotificationListView(generics.ListAPIView):
    """
    List all notifications for the logged-in student, ordered by newest first.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        student_profile = getattr(self.request.user, 'student_profile', None)
        if not student_profile:
            return Notification.objects.none()
        return Notification.objects.filter(student=student_profile).order_by('-created_at')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    """
    Returns the number of unread notifications for the logged-in student.
    """
    student_profile = getattr(request.user, 'student_profile', None)
    if not student_profile:
        return Response({'count': 0})
    
    count = Notification.objects.filter(student=student_profile, is_read=False).count()
    return Response({'count': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_as_read(request, pk):
    """
    Mark a specific notification as read.
    """
    student_profile = getattr(request.user, 'student_profile', None)
    if not student_profile:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        notification = Notification.objects.get(pk=pk, student=student_profile)
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'message': 'Marked as read.'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_as_read(request):
    """
    Mark all unread notifications for the logged-in student as read.
    """
    student_profile = getattr(request.user, 'student_profile', None)
    if not student_profile:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    Notification.objects.filter(student=student_profile, is_read=False).update(is_read=True)
    return Response({'message': 'All marked as read.'})
