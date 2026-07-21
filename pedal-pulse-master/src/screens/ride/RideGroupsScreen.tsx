import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore, RideGroup } from '../../store/useGroupStore';
import { useNavigation } from '@react-navigation/native';

export default function RideGroupsScreen() {
    const navigation = useNavigation<any>();
    const { myGroups, isLoading, fetchMyGroups, searchGroups, joinGroup } = useGroupStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RideGroup[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);

    useEffect(() => {
        fetchMyGroups();
    }, []);

    const handleSearch = async (text: string) => {
        setSearchQuery(text);
        if (text.length > 2) {
            setIsSearching(true);
            const results = await searchGroups(text);
            setSearchResults(results);
            setIsSearching(false);
        } else {
            setSearchResults([]);
        }
    };

    const handleJoin = async (group: RideGroup) => {
        const success = await joinGroup(group.id);
        if (success) {
            setShowSearchModal(false);
            setSearchQuery('');
            setSearchResults([]);
        }
    };

    const renderGroupItem = ({ item }: { item: RideGroup }) => (
        <TouchableOpacity
            style={styles.groupCard}
            onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        >
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.cardGradient}
            >
                <View style={styles.groupInfo}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="people" size={24} color="#FF2D55" />
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={styles.groupName}>{item.name}</Text>
                        <Text style={styles.groupDesc} numberOfLines={1}>{item.description}</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#121212', '#000000']}
                style={styles.background}
            />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Ride Groups</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('CreateGroup')}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.searchBar}
                onPress={() => setShowSearchModal(true)}
            >
                <Ionicons name="search" size={20} color="#666" />
                <Text style={styles.searchPlaceholder}>Search for new groups...</Text>
            </TouchableOpacity>

            {isLoading && !myGroups.length ? (
                <ActivityIndicator color="#FF2D55" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={myGroups}
                    renderItem={renderGroupItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="bicycle-outline" size={60} color="#333" />
                            <Text style={styles.emptyText}>You haven't joined any groups yet.</Text>
                            <TouchableOpacity
                                style={styles.emptyButton}
                                onPress={() => setShowSearchModal(true)}
                            >
                                <Text style={styles.emptyButtonText}>Explore Groups</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* Search Modal */}
            <Modal
                visible={showSearchModal}
                animationType="slide"
                transparent={true}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search groups..."
                                placeholderTextColor="#666"
                                autoFocus
                                value={searchQuery}
                                onChangeText={handleSearch}
                            />
                            <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                                <Text style={styles.closeText}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        {isSearching ? (
                            <ActivityIndicator color="#FF2D55" style={{ marginTop: 20 }} />
                        ) : (
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.searchResultItem}
                                        onPress={() => handleJoin(item)}
                                    >
                                        <View>
                                            <Text style={styles.resultName}>{item.name}</Text>
                                            <Text style={styles.resultDesc}>{item.description}</Text>
                                        </View>
                                        <Ionicons name="add-circle-outline" size={24} color="#FF2D55" />
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    searchQuery.length > 2 ? (
                                        <Text style={styles.noResults}>No groups found</Text>
                                    ) : null
                                }
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FF2D55',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 20,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 20,
    },
    searchPlaceholder: {
        color: '#666',
        marginLeft: 10,
        fontSize: 16,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    groupCard: {
        marginBottom: 15,
        borderRadius: 16,
        overflow: 'hidden',
    },
    cardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        justifyContent: 'space-between',
    },
    groupInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    textContainer: {
        flex: 1,
    },
    groupName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    groupDesc: {
        fontSize: 14,
        color: '#999',
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        marginTop: 20,
        textAlign: 'center',
    },
    emptyButton: {
        marginTop: 20,
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        borderWidth: 1,
        borderColor: '#FF2D55',
    },
    emptyButtonText: {
        color: '#FF2D55',
        fontWeight: 'bold',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '80%',
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalSearchInput: {
        flex: 1,
        height: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        paddingHorizontal: 15,
        color: '#fff',
        marginRight: 15,
    },
    closeText: {
        color: '#FF2D55',
        fontWeight: 'bold',
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    resultName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    resultDesc: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    noResults: {
        color: '#666',
        textAlign: 'center',
        marginTop: 20,
    }
});
