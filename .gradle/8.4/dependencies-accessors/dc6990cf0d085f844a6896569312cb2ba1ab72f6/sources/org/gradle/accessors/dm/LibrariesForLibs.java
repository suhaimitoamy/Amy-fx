package org.gradle.accessors.dm;

import org.gradle.api.NonNullApi;
import org.gradle.api.artifacts.MinimalExternalModuleDependency;
import org.gradle.plugin.use.PluginDependency;
import org.gradle.api.artifacts.ExternalModuleDependencyBundle;
import org.gradle.api.artifacts.MutableVersionConstraint;
import org.gradle.api.provider.Provider;
import org.gradle.api.model.ObjectFactory;
import org.gradle.api.provider.ProviderFactory;
import org.gradle.api.internal.catalog.AbstractExternalDependencyFactory;
import org.gradle.api.internal.catalog.DefaultVersionCatalog;
import java.util.Map;
import org.gradle.api.internal.attributes.ImmutableAttributesFactory;
import org.gradle.api.internal.artifacts.dsl.CapabilityNotationParser;
import javax.inject.Inject;

/**
 * A catalog of dependencies accessible via the `libs` extension.
 */
@NonNullApi
public class LibrariesForLibs extends AbstractExternalDependencyFactory {

    private final AbstractExternalDependencyFactory owner = this;
    private final AccompanistLibraryAccessors laccForAccompanistLibraryAccessors = new AccompanistLibraryAccessors(owner);
    private final AndroidxLibraryAccessors laccForAndroidxLibraryAccessors = new AndroidxLibraryAccessors(owner);
    private final CoilLibraryAccessors laccForCoilLibraryAccessors = new CoilLibraryAccessors(owner);
    private final ConverterLibraryAccessors laccForConverterLibraryAccessors = new ConverterLibraryAccessors(owner);
    private final FirebaseLibraryAccessors laccForFirebaseLibraryAccessors = new FirebaseLibraryAccessors(owner);
    private final KotlinxLibraryAccessors laccForKotlinxLibraryAccessors = new KotlinxLibraryAccessors(owner);
    private final LoggingLibraryAccessors laccForLoggingLibraryAccessors = new LoggingLibraryAccessors(owner);
    private final MoshiLibraryAccessors laccForMoshiLibraryAccessors = new MoshiLibraryAccessors(owner);
    private final PlayLibraryAccessors laccForPlayLibraryAccessors = new PlayLibraryAccessors(owner);
    private final RoborazziLibraryAccessors laccForRoborazziLibraryAccessors = new RoborazziLibraryAccessors(owner);
    private final VersionAccessors vaccForVersionAccessors = new VersionAccessors(providers, config);
    private final BundleAccessors baccForBundleAccessors = new BundleAccessors(objects, providers, config, attributesFactory, capabilityNotationParser);
    private final PluginAccessors paccForPluginAccessors = new PluginAccessors(providers, config);

    @Inject
    public LibrariesForLibs(DefaultVersionCatalog config, ProviderFactory providers, ObjectFactory objects, ImmutableAttributesFactory attributesFactory, CapabilityNotationParser capabilityNotationParser) {
        super(config, providers, objects, attributesFactory, capabilityNotationParser);
    }

        /**
         * Creates a dependency provider for junit (junit:junit)
         * This dependency was declared in catalog libs.versions.toml
         */
        public Provider<MinimalExternalModuleDependency> getJunit() {
            return create("junit");
    }

        /**
         * Creates a dependency provider for okhttp (com.squareup.okhttp3:okhttp)
         * This dependency was declared in catalog libs.versions.toml
         */
        public Provider<MinimalExternalModuleDependency> getOkhttp() {
            return create("okhttp");
    }

        /**
         * Creates a dependency provider for retrofit (com.squareup.retrofit2:retrofit)
         * This dependency was declared in catalog libs.versions.toml
         */
        public Provider<MinimalExternalModuleDependency> getRetrofit() {
            return create("retrofit");
    }

        /**
         * Creates a dependency provider for robolectric (org.robolectric:robolectric)
         * This dependency was declared in catalog libs.versions.toml
         */
        public Provider<MinimalExternalModuleDependency> getRobolectric() {
            return create("robolectric");
    }

    /**
     * Returns the group of libraries at accompanist
     */
    public AccompanistLibraryAccessors getAccompanist() {
        return laccForAccompanistLibraryAccessors;
    }

    /**
     * Returns the group of libraries at androidx
     */
    public AndroidxLibraryAccessors getAndroidx() {
        return laccForAndroidxLibraryAccessors;
    }

    /**
     * Returns the group of libraries at coil
     */
    public CoilLibraryAccessors getCoil() {
        return laccForCoilLibraryAccessors;
    }

    /**
     * Returns the group of libraries at converter
     */
    public ConverterLibraryAccessors getConverter() {
        return laccForConverterLibraryAccessors;
    }

    /**
     * Returns the group of libraries at firebase
     */
    public FirebaseLibraryAccessors getFirebase() {
        return laccForFirebaseLibraryAccessors;
    }

    /**
     * Returns the group of libraries at kotlinx
     */
    public KotlinxLibraryAccessors getKotlinx() {
        return laccForKotlinxLibraryAccessors;
    }

    /**
     * Returns the group of libraries at logging
     */
    public LoggingLibraryAccessors getLogging() {
        return laccForLoggingLibraryAccessors;
    }

    /**
     * Returns the group of libraries at moshi
     */
    public MoshiLibraryAccessors getMoshi() {
        return laccForMoshiLibraryAccessors;
    }

    /**
     * Returns the group of libraries at play
     */
    public PlayLibraryAccessors getPlay() {
        return laccForPlayLibraryAccessors;
    }

    /**
     * Returns the group of libraries at roborazzi
     */
    public RoborazziLibraryAccessors getRoborazzi() {
        return laccForRoborazziLibraryAccessors;
    }

    /**
     * Returns the group of versions at versions
     */
    public VersionAccessors getVersions() {
        return vaccForVersionAccessors;
    }

    /**
     * Returns the group of bundles at bundles
     */
    public BundleAccessors getBundles() {
        return baccForBundleAccessors;
    }

    /**
     * Returns the group of plugins at plugins
     */
    public PluginAccessors getPlugins() {
        return paccForPluginAccessors;
    }

    public static class AccompanistLibraryAccessors extends SubDependencyFactory {

        public AccompanistLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for permissions (com.google.accompanist:accompanist-permissions)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getPermissions() {
                return create("accompanist.permissions");
        }

    }

    public static class AndroidxLibraryAccessors extends SubDependencyFactory {
        private final AndroidxActivityLibraryAccessors laccForAndroidxActivityLibraryAccessors = new AndroidxActivityLibraryAccessors(owner);
        private final AndroidxCameraLibraryAccessors laccForAndroidxCameraLibraryAccessors = new AndroidxCameraLibraryAccessors(owner);
        private final AndroidxComposeLibraryAccessors laccForAndroidxComposeLibraryAccessors = new AndroidxComposeLibraryAccessors(owner);
        private final AndroidxCoreLibraryAccessors laccForAndroidxCoreLibraryAccessors = new AndroidxCoreLibraryAccessors(owner);
        private final AndroidxDatastoreLibraryAccessors laccForAndroidxDatastoreLibraryAccessors = new AndroidxDatastoreLibraryAccessors(owner);
        private final AndroidxEspressoLibraryAccessors laccForAndroidxEspressoLibraryAccessors = new AndroidxEspressoLibraryAccessors(owner);
        private final AndroidxLifecycleLibraryAccessors laccForAndroidxLifecycleLibraryAccessors = new AndroidxLifecycleLibraryAccessors(owner);
        private final AndroidxNavigationLibraryAccessors laccForAndroidxNavigationLibraryAccessors = new AndroidxNavigationLibraryAccessors(owner);
        private final AndroidxRoomLibraryAccessors laccForAndroidxRoomLibraryAccessors = new AndroidxRoomLibraryAccessors(owner);

        public AndroidxLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for junit (androidx.test.ext:junit)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getJunit() {
                return create("androidx.junit");
        }

            /**
             * Creates a dependency provider for runner (androidx.test:runner)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getRunner() {
                return create("androidx.runner");
        }

        /**
         * Returns the group of libraries at androidx.activity
         */
        public AndroidxActivityLibraryAccessors getActivity() {
            return laccForAndroidxActivityLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.camera
         */
        public AndroidxCameraLibraryAccessors getCamera() {
            return laccForAndroidxCameraLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.compose
         */
        public AndroidxComposeLibraryAccessors getCompose() {
            return laccForAndroidxComposeLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.core
         */
        public AndroidxCoreLibraryAccessors getCore() {
            return laccForAndroidxCoreLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.datastore
         */
        public AndroidxDatastoreLibraryAccessors getDatastore() {
            return laccForAndroidxDatastoreLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.espresso
         */
        public AndroidxEspressoLibraryAccessors getEspresso() {
            return laccForAndroidxEspressoLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.lifecycle
         */
        public AndroidxLifecycleLibraryAccessors getLifecycle() {
            return laccForAndroidxLifecycleLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.navigation
         */
        public AndroidxNavigationLibraryAccessors getNavigation() {
            return laccForAndroidxNavigationLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.room
         */
        public AndroidxRoomLibraryAccessors getRoom() {
            return laccForAndroidxRoomLibraryAccessors;
        }

    }

    public static class AndroidxActivityLibraryAccessors extends SubDependencyFactory {

        public AndroidxActivityLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for compose (androidx.activity:activity-compose)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCompose() {
                return create("androidx.activity.compose");
        }

    }

    public static class AndroidxCameraLibraryAccessors extends SubDependencyFactory {

        public AndroidxCameraLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for camera2 (androidx.camera:camera-camera2)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCamera2() {
                return create("androidx.camera.camera2");
        }

            /**
             * Creates a dependency provider for core (androidx.camera:camera-core)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCore() {
                return create("androidx.camera.core");
        }

            /**
             * Creates a dependency provider for lifecycle (androidx.camera:camera-lifecycle)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getLifecycle() {
                return create("androidx.camera.lifecycle");
        }

            /**
             * Creates a dependency provider for view (androidx.camera:camera-view)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getView() {
                return create("androidx.camera.view");
        }

    }

    public static class AndroidxComposeLibraryAccessors extends SubDependencyFactory {
        private final AndroidxComposeMaterialLibraryAccessors laccForAndroidxComposeMaterialLibraryAccessors = new AndroidxComposeMaterialLibraryAccessors(owner);
        private final AndroidxComposeUiLibraryAccessors laccForAndroidxComposeUiLibraryAccessors = new AndroidxComposeUiLibraryAccessors(owner);

        public AndroidxComposeLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for bom (androidx.compose:compose-bom)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getBom() {
                return create("androidx.compose.bom");
        }

            /**
             * Creates a dependency provider for material3 (androidx.compose.material3:material3)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getMaterial3() {
                return create("androidx.compose.material3");
        }

        /**
         * Returns the group of libraries at androidx.compose.material
         */
        public AndroidxComposeMaterialLibraryAccessors getMaterial() {
            return laccForAndroidxComposeMaterialLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.compose.ui
         */
        public AndroidxComposeUiLibraryAccessors getUi() {
            return laccForAndroidxComposeUiLibraryAccessors;
        }

    }

    public static class AndroidxComposeMaterialLibraryAccessors extends SubDependencyFactory {
        private final AndroidxComposeMaterialIconsLibraryAccessors laccForAndroidxComposeMaterialIconsLibraryAccessors = new AndroidxComposeMaterialIconsLibraryAccessors(owner);

        public AndroidxComposeMaterialLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

        /**
         * Returns the group of libraries at androidx.compose.material.icons
         */
        public AndroidxComposeMaterialIconsLibraryAccessors getIcons() {
            return laccForAndroidxComposeMaterialIconsLibraryAccessors;
        }

    }

    public static class AndroidxComposeMaterialIconsLibraryAccessors extends SubDependencyFactory {

        public AndroidxComposeMaterialIconsLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for core (androidx.compose.material:material-icons-core)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCore() {
                return create("androidx.compose.material.icons.core");
        }

            /**
             * Creates a dependency provider for extended (androidx.compose.material:material-icons-extended)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getExtended() {
                return create("androidx.compose.material.icons.extended");
        }

    }

    public static class AndroidxComposeUiLibraryAccessors extends SubDependencyFactory implements DependencyNotationSupplier {
        private final AndroidxComposeUiTestLibraryAccessors laccForAndroidxComposeUiTestLibraryAccessors = new AndroidxComposeUiTestLibraryAccessors(owner);
        private final AndroidxComposeUiToolingLibraryAccessors laccForAndroidxComposeUiToolingLibraryAccessors = new AndroidxComposeUiToolingLibraryAccessors(owner);

        public AndroidxComposeUiLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for ui (androidx.compose.ui:ui)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> asProvider() {
                return create("androidx.compose.ui");
        }

            /**
             * Creates a dependency provider for graphics (androidx.compose.ui:ui-graphics)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getGraphics() {
                return create("androidx.compose.ui.graphics");
        }

        /**
         * Returns the group of libraries at androidx.compose.ui.test
         */
        public AndroidxComposeUiTestLibraryAccessors getTest() {
            return laccForAndroidxComposeUiTestLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.compose.ui.tooling
         */
        public AndroidxComposeUiToolingLibraryAccessors getTooling() {
            return laccForAndroidxComposeUiToolingLibraryAccessors;
        }

    }

    public static class AndroidxComposeUiTestLibraryAccessors extends SubDependencyFactory {

        public AndroidxComposeUiTestLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for junit4 (androidx.compose.ui:ui-test-junit4)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getJunit4() {
                return create("androidx.compose.ui.test.junit4");
        }

            /**
             * Creates a dependency provider for manifest (androidx.compose.ui:ui-test-manifest)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getManifest() {
                return create("androidx.compose.ui.test.manifest");
        }

    }

    public static class AndroidxComposeUiToolingLibraryAccessors extends SubDependencyFactory implements DependencyNotationSupplier {

        public AndroidxComposeUiToolingLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for tooling (androidx.compose.ui:ui-tooling)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> asProvider() {
                return create("androidx.compose.ui.tooling");
        }

            /**
             * Creates a dependency provider for preview (androidx.compose.ui:ui-tooling-preview)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getPreview() {
                return create("androidx.compose.ui.tooling.preview");
        }

    }

    public static class AndroidxCoreLibraryAccessors extends SubDependencyFactory implements DependencyNotationSupplier {

        public AndroidxCoreLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for core (androidx.test:core)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> asProvider() {
                return create("androidx.core");
        }

            /**
             * Creates a dependency provider for ktx (androidx.core:core-ktx)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getKtx() {
                return create("androidx.core.ktx");
        }

    }

    public static class AndroidxDatastoreLibraryAccessors extends SubDependencyFactory {

        public AndroidxDatastoreLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for preferences (androidx.datastore:datastore-preferences)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getPreferences() {
                return create("androidx.datastore.preferences");
        }

    }

    public static class AndroidxEspressoLibraryAccessors extends SubDependencyFactory {

        public AndroidxEspressoLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for core (androidx.test.espresso:espresso-core)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCore() {
                return create("androidx.espresso.core");
        }

    }

    public static class AndroidxLifecycleLibraryAccessors extends SubDependencyFactory {
        private final AndroidxLifecycleRuntimeLibraryAccessors laccForAndroidxLifecycleRuntimeLibraryAccessors = new AndroidxLifecycleRuntimeLibraryAccessors(owner);
        private final AndroidxLifecycleViewmodelLibraryAccessors laccForAndroidxLifecycleViewmodelLibraryAccessors = new AndroidxLifecycleViewmodelLibraryAccessors(owner);

        public AndroidxLifecycleLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

        /**
         * Returns the group of libraries at androidx.lifecycle.runtime
         */
        public AndroidxLifecycleRuntimeLibraryAccessors getRuntime() {
            return laccForAndroidxLifecycleRuntimeLibraryAccessors;
        }

        /**
         * Returns the group of libraries at androidx.lifecycle.viewmodel
         */
        public AndroidxLifecycleViewmodelLibraryAccessors getViewmodel() {
            return laccForAndroidxLifecycleViewmodelLibraryAccessors;
        }

    }

    public static class AndroidxLifecycleRuntimeLibraryAccessors extends SubDependencyFactory {

        public AndroidxLifecycleRuntimeLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for compose (androidx.lifecycle:lifecycle-runtime-compose)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCompose() {
                return create("androidx.lifecycle.runtime.compose");
        }

            /**
             * Creates a dependency provider for ktx (androidx.lifecycle:lifecycle-runtime-ktx)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getKtx() {
                return create("androidx.lifecycle.runtime.ktx");
        }

    }

    public static class AndroidxLifecycleViewmodelLibraryAccessors extends SubDependencyFactory {

        public AndroidxLifecycleViewmodelLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for compose (androidx.lifecycle:lifecycle-viewmodel-compose)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCompose() {
                return create("androidx.lifecycle.viewmodel.compose");
        }

    }

    public static class AndroidxNavigationLibraryAccessors extends SubDependencyFactory {

        public AndroidxNavigationLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for compose (androidx.navigation:navigation-compose)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCompose() {
                return create("androidx.navigation.compose");
        }

    }

    public static class AndroidxRoomLibraryAccessors extends SubDependencyFactory {

        public AndroidxRoomLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for compiler (androidx.room:room-compiler)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCompiler() {
                return create("androidx.room.compiler");
        }

            /**
             * Creates a dependency provider for ktx (androidx.room:room-ktx)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getKtx() {
                return create("androidx.room.ktx");
        }

            /**
             * Creates a dependency provider for runtime (androidx.room:room-runtime)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getRuntime() {
                return create("androidx.room.runtime");
        }

    }

    public static class CoilLibraryAccessors extends SubDependencyFactory {

        public CoilLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for compose (io.coil-kt:coil-compose)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCompose() {
                return create("coil.compose");
        }

    }

    public static class ConverterLibraryAccessors extends SubDependencyFactory {

        public ConverterLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for moshi (com.squareup.retrofit2:converter-moshi)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getMoshi() {
                return create("converter.moshi");
        }

    }

    public static class FirebaseLibraryAccessors extends SubDependencyFactory {

        public FirebaseLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for ai (com.google.firebase:firebase-ai)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getAi() {
                return create("firebase.ai");
        }

            /**
             * Creates a dependency provider for bom (com.google.firebase:firebase-bom)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getBom() {
                return create("firebase.bom");
        }

    }

    public static class KotlinxLibraryAccessors extends SubDependencyFactory {
        private final KotlinxCoroutinesLibraryAccessors laccForKotlinxCoroutinesLibraryAccessors = new KotlinxCoroutinesLibraryAccessors(owner);

        public KotlinxLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

        /**
         * Returns the group of libraries at kotlinx.coroutines
         */
        public KotlinxCoroutinesLibraryAccessors getCoroutines() {
            return laccForKotlinxCoroutinesLibraryAccessors;
        }

    }

    public static class KotlinxCoroutinesLibraryAccessors extends SubDependencyFactory {

        public KotlinxCoroutinesLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for android (org.jetbrains.kotlinx:kotlinx-coroutines-android)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getAndroid() {
                return create("kotlinx.coroutines.android");
        }

            /**
             * Creates a dependency provider for core (org.jetbrains.kotlinx:kotlinx-coroutines-core)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCore() {
                return create("kotlinx.coroutines.core");
        }

            /**
             * Creates a dependency provider for test (org.jetbrains.kotlinx:kotlinx-coroutines-test)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getTest() {
                return create("kotlinx.coroutines.test");
        }

    }

    public static class LoggingLibraryAccessors extends SubDependencyFactory {

        public LoggingLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for interceptor (com.squareup.okhttp3:logging-interceptor)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getInterceptor() {
                return create("logging.interceptor");
        }

    }

    public static class MoshiLibraryAccessors extends SubDependencyFactory {
        private final MoshiKotlinLibraryAccessors laccForMoshiKotlinLibraryAccessors = new MoshiKotlinLibraryAccessors(owner);

        public MoshiLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

        /**
         * Returns the group of libraries at moshi.kotlin
         */
        public MoshiKotlinLibraryAccessors getKotlin() {
            return laccForMoshiKotlinLibraryAccessors;
        }

    }

    public static class MoshiKotlinLibraryAccessors extends SubDependencyFactory implements DependencyNotationSupplier {

        public MoshiKotlinLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for kotlin (com.squareup.moshi:moshi-kotlin)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> asProvider() {
                return create("moshi.kotlin");
        }

            /**
             * Creates a dependency provider for codegen (com.squareup.moshi:moshi-kotlin-codegen)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCodegen() {
                return create("moshi.kotlin.codegen");
        }

    }

    public static class PlayLibraryAccessors extends SubDependencyFactory {
        private final PlayServicesLibraryAccessors laccForPlayServicesLibraryAccessors = new PlayServicesLibraryAccessors(owner);

        public PlayLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

        /**
         * Returns the group of libraries at play.services
         */
        public PlayServicesLibraryAccessors getServices() {
            return laccForPlayServicesLibraryAccessors;
        }

    }

    public static class PlayServicesLibraryAccessors extends SubDependencyFactory {

        public PlayServicesLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for location (com.google.android.gms:play-services-location)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getLocation() {
                return create("play.services.location");
        }

    }

    public static class RoborazziLibraryAccessors extends SubDependencyFactory implements DependencyNotationSupplier {
        private final RoborazziJunitLibraryAccessors laccForRoborazziJunitLibraryAccessors = new RoborazziJunitLibraryAccessors(owner);

        public RoborazziLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for roborazzi (io.github.takahirom.roborazzi:roborazzi)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> asProvider() {
                return create("roborazzi");
        }

            /**
             * Creates a dependency provider for compose (io.github.takahirom.roborazzi:roborazzi-compose)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getCompose() {
                return create("roborazzi.compose");
        }

        /**
         * Returns the group of libraries at roborazzi.junit
         */
        public RoborazziJunitLibraryAccessors getJunit() {
            return laccForRoborazziJunitLibraryAccessors;
        }

    }

    public static class RoborazziJunitLibraryAccessors extends SubDependencyFactory {

        public RoborazziJunitLibraryAccessors(AbstractExternalDependencyFactory owner) { super(owner); }

            /**
             * Creates a dependency provider for rule (io.github.takahirom.roborazzi:roborazzi-junit-rule)
             * This dependency was declared in catalog libs.versions.toml
             */
            public Provider<MinimalExternalModuleDependency> getRule() {
                return create("roborazzi.junit.rule");
        }

    }

    public static class VersionAccessors extends VersionFactory  {

        public VersionAccessors(ProviderFactory providers, DefaultVersionCatalog config) { super(providers, config); }

            /**
             * Returns the version associated to this alias: accompanistPermissions (0.37.3)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getAccompanistPermissions() { return getVersion("accompanistPermissions"); }

            /**
             * Returns the version associated to this alias: activityCompose (1.10.1)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getActivityCompose() { return getVersion("activityCompose"); }

            /**
             * Returns the version associated to this alias: agp (9.1.1)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getAgp() { return getVersion("agp"); }

            /**
             * Returns the version associated to this alias: cameraCamera2 (1.5.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getCameraCamera2() { return getVersion("cameraCamera2"); }

            /**
             * Returns the version associated to this alias: cameraCore (1.5.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getCameraCore() { return getVersion("cameraCore"); }

            /**
             * Returns the version associated to this alias: cameraLifecycle (1.5.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getCameraLifecycle() { return getVersion("cameraLifecycle"); }

            /**
             * Returns the version associated to this alias: cameraView (1.5.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getCameraView() { return getVersion("cameraView"); }

            /**
             * Returns the version associated to this alias: coilCompose (2.7.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getCoilCompose() { return getVersion("coilCompose"); }

            /**
             * Returns the version associated to this alias: composeBom (2024.09.00)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getComposeBom() { return getVersion("composeBom"); }

            /**
             * Returns the version associated to this alias: converterMoshi (2.12.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getConverterMoshi() { return getVersion("converterMoshi"); }

            /**
             * Returns the version associated to this alias: core (1.6.1)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getCore() { return getVersion("core"); }

            /**
             * Returns the version associated to this alias: coreKtx (1.18.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getCoreKtx() { return getVersion("coreKtx"); }

            /**
             * Returns the version associated to this alias: datastorePreferences (1.1.7)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getDatastorePreferences() { return getVersion("datastorePreferences"); }

            /**
             * Returns the version associated to this alias: espressoCore (3.7.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getEspressoCore() { return getVersion("espressoCore"); }

            /**
             * Returns the version associated to this alias: firebaseBom (34.12.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getFirebaseBom() { return getVersion("firebaseBom"); }

            /**
             * Returns the version associated to this alias: googleDevtoolsKsp (2.3.5)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getGoogleDevtoolsKsp() { return getVersion("googleDevtoolsKsp"); }

            /**
             * Returns the version associated to this alias: junit (4.13.2)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getJunit() { return getVersion("junit"); }

            /**
             * Returns the version associated to this alias: junitVersion (1.3.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getJunitVersion() { return getVersion("junitVersion"); }

            /**
             * Returns the version associated to this alias: kotlin (2.2.10)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getKotlin() { return getVersion("kotlin"); }

            /**
             * Returns the version associated to this alias: kotlinxCoroutinesAndroid (1.10.2)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getKotlinxCoroutinesAndroid() { return getVersion("kotlinxCoroutinesAndroid"); }

            /**
             * Returns the version associated to this alias: kotlinxCoroutinesCore (1.10.2)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getKotlinxCoroutinesCore() { return getVersion("kotlinxCoroutinesCore"); }

            /**
             * Returns the version associated to this alias: kotlinxCoroutinesTest (1.10.2)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getKotlinxCoroutinesTest() { return getVersion("kotlinxCoroutinesTest"); }

            /**
             * Returns the version associated to this alias: lifecycleRuntimeCompose (2.8.7)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getLifecycleRuntimeCompose() { return getVersion("lifecycleRuntimeCompose"); }

            /**
             * Returns the version associated to this alias: lifecycleRuntimeKtx (2.8.7)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getLifecycleRuntimeKtx() { return getVersion("lifecycleRuntimeKtx"); }

            /**
             * Returns the version associated to this alias: lifecycleViewmodelCompose (2.8.7)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getLifecycleViewmodelCompose() { return getVersion("lifecycleViewmodelCompose"); }

            /**
             * Returns the version associated to this alias: loggingInterceptor (4.10.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getLoggingInterceptor() { return getVersion("loggingInterceptor"); }

            /**
             * Returns the version associated to this alias: moshiKotlin (1.15.2)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getMoshiKotlin() { return getVersion("moshiKotlin"); }

            /**
             * Returns the version associated to this alias: moshiKotlinCodegen (1.15.2)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getMoshiKotlinCodegen() { return getVersion("moshiKotlinCodegen"); }

            /**
             * Returns the version associated to this alias: navigationCompose (2.8.9)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getNavigationCompose() { return getVersion("navigationCompose"); }

            /**
             * Returns the version associated to this alias: okhttp (4.10.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getOkhttp() { return getVersion("okhttp"); }

            /**
             * Returns the version associated to this alias: playServicesLocation (21.3.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getPlayServicesLocation() { return getVersion("playServicesLocation"); }

            /**
             * Returns the version associated to this alias: retrofit (2.12.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getRetrofit() { return getVersion("retrofit"); }

            /**
             * Returns the version associated to this alias: robolectric (4.16.1)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getRobolectric() { return getVersion("robolectric"); }

            /**
             * Returns the version associated to this alias: roborazzi (1.59.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getRoborazzi() { return getVersion("roborazzi"); }

            /**
             * Returns the version associated to this alias: roomCompiler (2.7.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getRoomCompiler() { return getVersion("roomCompiler"); }

            /**
             * Returns the version associated to this alias: roomKtx (2.7.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getRoomKtx() { return getVersion("roomKtx"); }

            /**
             * Returns the version associated to this alias: roomRuntime (2.7.0)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getRoomRuntime() { return getVersion("roomRuntime"); }

            /**
             * Returns the version associated to this alias: runner (1.6.2)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getRunner() { return getVersion("runner"); }

            /**
             * Returns the version associated to this alias: secretsGradlePlugin (2.0.1)
             * If the version is a rich version and that its not expressible as a
             * single version string, then an empty string is returned.
             * This version was declared in catalog libs.versions.toml
             */
            public Provider<String> getSecretsGradlePlugin() { return getVersion("secretsGradlePlugin"); }

    }

    public static class BundleAccessors extends BundleFactory {

        public BundleAccessors(ObjectFactory objects, ProviderFactory providers, DefaultVersionCatalog config, ImmutableAttributesFactory attributesFactory, CapabilityNotationParser capabilityNotationParser) { super(objects, providers, config, attributesFactory, capabilityNotationParser); }

    }

    public static class PluginAccessors extends PluginFactory {
        private final AndroidPluginAccessors paccForAndroidPluginAccessors = new AndroidPluginAccessors(providers, config);
        private final GooglePluginAccessors paccForGooglePluginAccessors = new GooglePluginAccessors(providers, config);
        private final KotlinPluginAccessors paccForKotlinPluginAccessors = new KotlinPluginAccessors(providers, config);

        public PluginAccessors(ProviderFactory providers, DefaultVersionCatalog config) { super(providers, config); }

            /**
             * Creates a plugin provider for roborazzi to the plugin id 'io.github.takahirom.roborazzi'
             * This plugin was declared in catalog libs.versions.toml
             */
            public Provider<PluginDependency> getRoborazzi() { return createPlugin("roborazzi"); }

            /**
             * Creates a plugin provider for secrets to the plugin id 'com.google.android.libraries.mapsplatform.secrets-gradle-plugin'
             * This plugin was declared in catalog libs.versions.toml
             */
            public Provider<PluginDependency> getSecrets() { return createPlugin("secrets"); }

        /**
         * Returns the group of plugins at plugins.android
         */
        public AndroidPluginAccessors getAndroid() {
            return paccForAndroidPluginAccessors;
        }

        /**
         * Returns the group of plugins at plugins.google
         */
        public GooglePluginAccessors getGoogle() {
            return paccForGooglePluginAccessors;
        }

        /**
         * Returns the group of plugins at plugins.kotlin
         */
        public KotlinPluginAccessors getKotlin() {
            return paccForKotlinPluginAccessors;
        }

    }

    public static class AndroidPluginAccessors extends PluginFactory {

        public AndroidPluginAccessors(ProviderFactory providers, DefaultVersionCatalog config) { super(providers, config); }

            /**
             * Creates a plugin provider for android.application to the plugin id 'com.android.application'
             * This plugin was declared in catalog libs.versions.toml
             */
            public Provider<PluginDependency> getApplication() { return createPlugin("android.application"); }

    }

    public static class GooglePluginAccessors extends PluginFactory {
        private final GoogleDevtoolsPluginAccessors paccForGoogleDevtoolsPluginAccessors = new GoogleDevtoolsPluginAccessors(providers, config);

        public GooglePluginAccessors(ProviderFactory providers, DefaultVersionCatalog config) { super(providers, config); }

        /**
         * Returns the group of plugins at plugins.google.devtools
         */
        public GoogleDevtoolsPluginAccessors getDevtools() {
            return paccForGoogleDevtoolsPluginAccessors;
        }

    }

    public static class GoogleDevtoolsPluginAccessors extends PluginFactory {

        public GoogleDevtoolsPluginAccessors(ProviderFactory providers, DefaultVersionCatalog config) { super(providers, config); }

            /**
             * Creates a plugin provider for google.devtools.ksp to the plugin id 'com.google.devtools.ksp'
             * This plugin was declared in catalog libs.versions.toml
             */
            public Provider<PluginDependency> getKsp() { return createPlugin("google.devtools.ksp"); }

    }

    public static class KotlinPluginAccessors extends PluginFactory {

        public KotlinPluginAccessors(ProviderFactory providers, DefaultVersionCatalog config) { super(providers, config); }

            /**
             * Creates a plugin provider for kotlin.compose to the plugin id 'org.jetbrains.kotlin.plugin.compose'
             * This plugin was declared in catalog libs.versions.toml
             */
            public Provider<PluginDependency> getCompose() { return createPlugin("kotlin.compose"); }

    }

}
