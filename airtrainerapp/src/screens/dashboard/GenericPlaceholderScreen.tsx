import React from 'react';
import { ScreenWrapper, ScreenHeader, EmptyState } from '../../components/ui';

export default function GenericPlaceholderScreen({ navigation, route }: any) {
    const title = route.name || 'Screen';

    return (
        <ScreenWrapper scrollable={false}>
            <ScreenHeader title={title} onBack={() => navigation.goBack()} />
            <EmptyState
                icon="construct-outline"
                title="Under Construction"
                description="This page is coming soon."
            />
        </ScreenWrapper>
    );
}
