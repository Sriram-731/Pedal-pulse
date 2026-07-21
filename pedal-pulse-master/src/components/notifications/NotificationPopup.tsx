import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore, Notification } from '../../store/useNotificationStore';

const { width } = Dimensions.get('window');
const POPUP_DURATION = 5000; // Show for 5 seconds

export default function NotificationPopup() {
    const notifications = useNotificationStore(s => s.notifications);
    const translateY = useRef(new Animated.Value(-150)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const currentNotifRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const markAsRead = useNotificationStore(s => s.markAsRead);

    // Watch for new unread notifications
    useEffect(() => {
        const latestUnread = notifications.find(n => !n.is_read);
        if (!latestUnread) return;
        if (latestUnread.id === currentNotifRef.current) return;

        // New notification — show popup
        currentNotifRef.current = latestUnread.id;
        showPopup();
    }, [notifications]);

    const showPopup = () => {
        // Clear previous timer
        if (timerRef.current) clearTimeout(timerRef.current);

        // Slide in
        translateY.setValue(-150);
        opacity.setValue(0);
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 12,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto-hide after duration
        timerRef.current = setTimeout(hidePopup, POPUP_DURATION);
    };

    const hidePopup = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -150,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            currentNotifRef.current = null;
        });
    };

    const handleDismiss = () => {
        if (currentNotifRef.current) {
            markAsRead(currentNotifRef.current);
        }
        hidePopup();
    };

    const currentNotif = notifications.find(n => n.id === currentNotifRef.current);
    if (!currentNotif) return null;

    const isEmergency = currentNotif.type === 'emergency';

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
            pointerEvents="box-none"
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleDismiss}
                style={[styles.popup, isEmergency && styles.emergencyPopup]}
            >
                <View style={[styles.iconWrap, isEmergency && styles.emergencyIconWrap]}>
                    <Ionicons
                        name={isEmergency ? 'warning' : 'notifications'}
                        size={20}
                        color={isEmergency ? '#FF3B30' : '#FF2D55'}
                    />
                </View>
                <View style={styles.textContainer}>
                    <Text
                        style={[styles.title, isEmergency && styles.emergencyTitle]}
                        numberOfLines={1}
                    >
                        {currentNotif.title}
                    </Text>
                    <Text style={styles.body} numberOfLines={2}>
                        {currentNotif.body}
                    </Text>
                </View>
                <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
                    <Ionicons name="close" size={18} color="#888" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    popup: {
        width: width - 32,
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 20,
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    emergencyPopup: {
        backgroundColor: '#2D0A0A',
        borderColor: '#FF3B30',
        borderWidth: 1.5,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 45, 85, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    emergencyIconWrap: {
        backgroundColor: 'rgba(255, 59, 48, 0.2)',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
    },
    emergencyTitle: {
        color: '#FF3B30',
    },
    body: {
        fontSize: 12,
        color: '#999',
        lineHeight: 16,
    },
    closeBtn: {
        padding: 6,
        marginLeft: 8,
    },
});
