import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme/tokens';
import { Eye, EyeOff } from 'lucide-react-native';

export const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  containerStyle,
  style,
  keyboardType = 'default',
  autoCapitalize = 'none',
  ...props
}) => {
  const { colors, isDark } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: error ? colors.error : colors.border,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          },
        ]}
      >
        {secureTextEntry && (
          <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeButton}>
            {isPasswordVisible ? (
              <EyeOff size={18} color={colors.textSecondary} />
            ) : (
              <Eye size={18} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={[styles.input, { color: colors.text }, style]}
          {...props}
        />
      </View>
      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
    width: '100%',
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.medium,
    marginBottom: SPACING.xs,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'right',
    paddingVertical: SPACING.sm,
  },
  eyeButton: {
    marginRight: SPACING.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: SPACING.xs,
    textAlign: 'right',
  },
});

export default Input;
