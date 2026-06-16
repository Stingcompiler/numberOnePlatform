"""
================================================================================
backups/serializers.py
================================================================================
"""

from rest_framework import serializers
from .models import BackupFile, BackupSettings, RestoreLog


class BackupFileSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default="")
    size_display = serializers.SerializerMethodField()

    class Meta:
        model  = BackupFile
        fields = [
            "id", "filename", "size_bytes", "size_display",
            "backup_type", "notes", "created_at", "created_by", "created_by_name",
        ]
        read_only_fields = ["id", "filename", "size_bytes", "created_at", "created_by"]

    def get_size_display(self, obj):
        """تحويل الحجم إلى صيغة مقروءة."""
        size = obj.size_bytes
        if size < 1024:
            return f"{size} B"
        elif size < 1024 ** 2:
            return f"{size / 1024:.1f} KB"
        elif size < 1024 ** 3:
            return f"{size / (1024 ** 2):.1f} MB"
        return f"{size / (1024 ** 3):.2f} GB"


class CreateBackupSerializer(serializers.Serializer):
    backup_type = serializers.ChoiceField(
        choices=BackupFile.BackupType.choices,
        default=BackupFile.BackupType.FULL,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class BackupSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = BackupSettings
        fields = [
            "auto_backup_enabled", "frequency", "keep_last_n", "last_auto_backup_at",
        ]


class RestoreLogSerializer(serializers.ModelSerializer):
    restored_by_name = serializers.CharField(source="restored_by.full_name", read_only=True, default="")

    class Meta:
        model  = RestoreLog
        fields = [
            "id", "backup_file", "backup_filename",
            "restored_by", "restored_by_name",
            "restored_at", "status", "log_text",
        ]
