package com.signageplayertv;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.List;

public class DeviceIdPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(
            ReactApplicationContext reactContext) {

        List<NativeModule> modules = new ArrayList<>();
        modules.add(new DeviceIdModule(reactContext));
        modules.add(new UsbManagerModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(
            ReactApplicationContext reactContext) {
        List<ViewManager> managers = new ArrayList<>();
        managers.add(new NativeVideoPlayerManager());
        return managers;
    }
}
