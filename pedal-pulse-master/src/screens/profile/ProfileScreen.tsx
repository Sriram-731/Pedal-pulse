import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../config/supabase';

export default function ProfileScreen() {
    const user = useAuthStore((state) => state.user);
    const profile = useAuthStore((state) => state.profile);
    const updateProfile = useAuthStore((state) => state.updateProfile);
    const signOut = useAuthStore((state) => state.signOut);
    const isLoading = useAuthStore((state) => state.isLoading);

    const [uploading, setUploading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        age: '',
        height: '',
        weight: '',
        blood_group: '',
        emergency_contact_phone: '',
        medical_notes: ''
    });

    useEffect(() => {
        if (profile) {
            setForm({
                name: profile.name || '',
                age: profile.age?.toString() || '',
                height: profile.height?.toString() || '',
                weight: profile.weight?.toString() || '',
                blood_group: profile.blood_group || '',
                emergency_contact_phone: profile.emergency_contact_phone || '',
                medical_notes: profile.medical_notes || ''
            });
        }
    }, [profile]);

    const bmi = useMemo(() => {
        const h = parseFloat(form.height);
        const w = parseFloat(form.weight);
        if (h > 0 && w > 0) {
            const heightMeters = h / 100;
            return (w / (heightMeters * heightMeters)).toFixed(1);
        }
        return null;
    }, [form.height, form.weight]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            uploadAvatar(result.assets[0].uri);
        }
    };

    const uploadAvatar = async (uri: string) => {
        if (!user) return;
        setUploading(true);

        try {
            const fileExt = uri.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Create form data for upload
            const formData = new FormData();
            formData.append('file', {
                uri,
                name: fileName,
                type: `image/${fileExt}`,
            } as any);

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, formData);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update profile
            await updateProfile(user.id, { avatar_url: publicUrl });
            Alert.alert('Success', 'Avatar updated!');
        } catch (error: any) {
            Alert.alert('Upload Error', error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

        if (form.age && isNaN(parseInt(form.age))) return Alert.alert('Invalid Age');
        if (form.height && isNaN(parseFloat(form.height))) return Alert.alert('Invalid Height');
        if (form.weight && isNaN(parseFloat(form.weight))) return Alert.alert('Invalid Weight');

        const success = await updateProfile(user.id, {
            name: form.name,
            age: form.age ? parseInt(form.age) : undefined,
            height: form.height ? parseFloat(form.height) : undefined,
            weight: form.weight ? parseFloat(form.weight) : undefined,
            blood_group: form.blood_group,
            emergency_contact_phone: form.emergency_contact_phone,
            medical_notes: form.medical_notes
        });

        if (success) {
            Alert.alert('Success', 'Profile updated successfully.');
        } else {
            Alert.alert('Error', 'Could not update profile.');
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F0F' }}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.headerRow}>
                    <Text style={styles.header}>Profile</Text>
                    <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
                        <Ionicons name="log-out-outline" size={22} color="#FF2D55" />
                    </TouchableOpacity>
                </View>

                <View style={styles.avatarSection}>
                    <View style={styles.avatarWrapper}>
                        {profile?.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={styles.avatarLargeImage} />
                        ) : (
                            <LinearGradient
                                colors={['#FF2D55', '#D40035']}
                                style={styles.avatarLarge}
                            >
                                <Text style={styles.avatarTextLarge}>{profile?.name?.charAt(0).toUpperCase() || 'U'}</Text>
                            </LinearGradient>
                        )}
                        <TouchableOpacity
                            style={styles.editAvatarBtn}
                            onPress={pickImage}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="camera" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.profileEmail}>{user?.email}</Text>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Personal Details</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        value={form.name}
                        placeholder="Your full name"
                        placeholderTextColor="#444"
                        onChangeText={(v) => setForm({ ...form, name: v })}
                    />

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Age</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={form.age} onChangeText={(v) => setForm({ ...form, age: v })} />
                        </View>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>H (cm)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={form.height} onChangeText={(v) => setForm({ ...form, height: v })} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>W (kg)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={form.weight} onChangeText={(v) => setForm({ ...form, weight: v })} />
                        </View>
                    </View>

                    {bmi && (
                        <View style={styles.bmiBadge}>
                            <Ionicons name="fitness" size={16} color="#FF2D55" />
                            <Text style={styles.bmiText}>BMI: {bmi}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Safety & Health</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>Blood Group</Text>
                    <TextInput style={styles.input} value={form.blood_group} placeholder="e.g. O+" placeholderTextColor="#444" onChangeText={(v) => setForm({ ...form, blood_group: v })} />

                    <Text style={styles.label}>Emergency Phone</Text>
                    <TextInput style={styles.input} keyboardType="phone-pad" value={form.emergency_contact_phone} placeholder="Contact number" placeholderTextColor="#444" onChangeText={(v) => setForm({ ...form, emergency_contact_phone: v })} />

                    <Text style={styles.label}>Medical Notes</Text>
                    <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={form.medical_notes} placeholder="Allergies, chronic conditions..." placeholderTextColor="#444" onChangeText={(v) => setForm({ ...form, medical_notes: v })} />
                </View>

                <TouchableOpacity
                    activeOpacity={0.9}
                    style={[styles.saveButton, isLoading && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    <LinearGradient
                        colors={['#FF2D55', '#D40035']}
                        style={styles.saveGradient}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.footerSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        backgroundColor: '#0F0F0F',
        flexGrow: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 25,
    },
    header: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff'
    },
    signOutBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 15,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#FF2D55',
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    avatarLargeImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#FF2D55',
    },
    editAvatarBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FF2D55',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#1C1C1E',
    },
    avatarTextLarge: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#fff'
    },
    profileEmail: {
        color: '#888',
        fontSize: 14,
    },
    sectionHeader: {
        marginBottom: 12,
        marginTop: 5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: '#1C1C1E',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#2C2C2E',
        marginBottom: 25,
    },
    label: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    input: {
        backgroundColor: '#0F0F0F',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: '#fff',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    bmiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 10,
        alignSelf: 'flex-start',
        marginTop: 5,
    },
    bmiText: {
        color: '#FF2D55',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 8,
    },
    saveButton: {
        borderRadius: 15,
        height: 55,
        overflow: 'hidden',
        marginTop: 10,
        marginBottom: 20,
    },
    saveGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footerSpacer: {
        height: 40,
    }
});
