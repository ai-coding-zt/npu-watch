# npu-smi Troubleshooting Guide

Common issues and solutions when using npu-smi commands.

## Table of Contents

1. [Permission Issues](#permission-issues)
2. [Device Not Found](#device-not-found)
3. [Command Not Supported](#command-not-supported)
4. [Firmware Upgrade Issues](#firmware-upgrade-issues)
5. [vNPU Issues](#vnpu-issues)
6. [Certificate Issues](#certificate-issues)
7. [Fan Control Issues](#fan-control-issues)
8. [Temperature/Power Issues](#temperaturepower-issues)
9. [Log Collection Issues](#log-collection-issues)
10. [Error Codes](#error-codes)

---

## Permission Issues

### Symptom
```
Error: Permission denied
```

### Solution
```bash
# Run with sudo
sudo npu-smi info -l

# Or switch to root user
su -
npu-smi info -l
```

### Notes
- Most configuration commands require root permissions
- Some query commands work with runtime user group
- Check deployment scenario support table in SKILL.md

---

## Device Not Found

### Symptom
```
Error: Device not found
```

### Solution
```bash
# 1. List available devices
npu-smi info -l

# 2. Check if driver is loaded
lsmod | grep drv

# 3. Check device files
ls /dev/davinci*

# 4. Restart driver if needed
rmmod drv
insmod drv.ko
```

### Notes
- Device IDs start from 0
- Verify device is properly connected
- Check dmesg for driver errors

---

## Command Not Supported

### Symptom
```
Error: Command not supported
```

### Solution
```bash
# 1. Check hardware platform support
npu-smi info -t product -i 0 -c 0

# 2. Verify command availability
npu-smi info --help
npu-smi set --help
npu-smi upgrade --help
```

### Notes
- Command availability varies by hardware platform
- Some commands not supported for MCU Chip ID
- Check SKILL.md for platform-specific notes

---

## Firmware Upgrade Issues

### MCU Upgrade Fails

#### Symptom
```
Status: Fail
Message: Upgrade failed
```

#### Solution
```bash
# 1. Check if upgrade was forcibly terminated
# Wait 10+ minutes before retry

# 2. Verify firmware file
file ./Ascend-hdk-xxx-mcu_x.x.x.hpm

# 3. Check file integrity
md5sum ./Ascend-hdk-xxx-mcu_x.x.x.hpm

# 4. Retry upgrade
npu-smi upgrade -t mcu -i 0 -f ./Ascend-hdk-xxx-mcu_x.x.x.hpm

# 5. Query status
npu-smi upgrade -q mcu -i 0
```

### VRD Upgrade Fails

#### Symptom
```
VRD upgrade not activated
```

#### Solution
```bash
# 1. Power cycle (30+ seconds off)
# 2. Power on
# 3. Verify VRD status
npu-smi upgrade -b vrd -i 0

# 4. Cannot upgrade VRD again until activated
```

### Bootloader Upgrade Fails

#### Solution
```bash
# 1. Verify bootloader file
file ./bootloader.bin

# 2. Check file permissions
ls -la ./bootloader.bin

# 3. Retry upgrade
npu-smi upgrade -t bootloader -i 0 -f ./bootloader.bin

# 4. Activate
npu-smi upgrade -a bootloader -i 0
```

---

## vNPU Issues

### Cannot Create vNPU

#### Symptom
```
Error: Failed to create vNPU
```

#### Solution
```bash
# 1. Check AVI mode
npu-smi info -t vnpu-mode

# 2. Query available templates
npu-smi info -t template-info -i 0

# 3. Verify template exists
npu-smi info -t template-info -i 0 | grep vir02

# 4. Check chip ID
npu-smi info -m

# 5. Verify vnpu_id range
# Range: [phy_id*16 + 100, phy_id*16 + 115]
ls /dev/davinci*

# 6. Create with auto-assigned ID
npu-smi set -t create-vnpu -i 0 -c 0 -f vir02
```

### vNPU ID Conflict

#### Symptom
```
Error: vNPU ID already exists
```

#### Solution
```bash
# 1. List existing vNPU instances
npu-smi info -t info-vnpu -i 0 -c 0

# 2. Use different vnpu_id
npu-smi set -t create-vnpu -i 0 -c 0 -f vir02 -v 104

# 3. Or destroy existing vNPU first
npu-smi set -t destroy-vnpu -i 0 -c 0 -v 103
```

---

## Certificate Issues

### CSR Generation Fails

#### Symptom
```
Error: Failed to get CSR
```

#### Solution
```bash
# 1. Verify device and chip ID
npu-smi info -l
npu-smi info -m

# 2. Check if command supported for this platform
npu-smi info -t product -i 0 -c 0

# 3. Retry CSR generation
npu-smi info -t tls-csr-get -i 0 -c 0
```

### Certificate Import Fails

#### Symptom
```
Error: Failed to import certificate
```

#### Solution
```bash
# 1. Verify certificate files exist
ls -la rsa.d2.pem rsa.rca.pem rsa.oca.pem

# 2. Check file format (should be PEM)
head -1 rsa.d2.pem
# Should show: -----BEGIN CERTIFICATE-----

# 3. Verify certificate chain
openssl verify -CAfile rsa.rca.pem -untrusted rsa.oca.pem rsa.d2.pem

# 4. Check total size (must not exceed 8192 bytes)
wc -c rsa.d2.pem rsa.rca.pem rsa.oca.pem

# 5. Retry import
npu-smi set -t tls-cert -i 0 -c 0 -f "rsa.d2.pem rsa.rca.pem rsa.oca.pem"
```

### Certificate Expiration Alert

#### Solution
```bash
# 1. Check current certificate
npu-smi info -t tls-cert -i 0 -c 0

# 2. Check expiration threshold
npu-smi info -t tls-cert-period -i 0 -c 0

# 3. Adjust threshold if needed
npu-smi set -t tls-cert-period -i 0 -c 0 -s 60

# 4. Or renew certificate
npu-smi info -t tls-csr-get -i 0 -c 0
# Submit CSR to CA and import new certificate
```

---

## Fan Control Issues

### Cannot Set Fan Speed

#### Symptom
```
Error: Cannot set fan speed in automatic mode
```

#### Solution
```bash
# 1. Check current fan mode
npu-smi info -t sensors -i 0 -c 0

# 2. Switch to manual mode
npu-smi set -t pwm-mode -d 0

# 3. Set fan speed
npu-smi set -t pwm-duty-ratio -d 40

# 4. Verify setting
npu-smi info -t sensors -i 0 -c 0
```

### Fan Speed Not Applied

#### Solution
```bash
# 1. Verify manual mode is set
npu-smi set -t pwm-mode -d 0

# 2. Check valid range [0-100]
npu-smi set -t pwm-duty-ratio -d 50

# 3. In automatic mode, max is 39
npu-smi set -t pwm-mode -d 1
npu-smi set -t pwm-duty-ratio -d 39  # Max in auto mode
```

---

## Temperature/Power Issues

### Temperature Threshold Not Working

#### Solution
```bash
# 1. Check current temperature
npu-smi info -t temperature -i 0 -c 0

# 2. Verify threshold setting
npu-smi set -t temperature -i 0 -c 0 -d 85

# 3. Check if within valid range
# Valid range depends on hardware platform

# 4. Monitor temperature
watch -n 5 "npu-smi info -t temperature -i 0 -c 0"
```

### Power Limit Not Applied

#### Solution
```bash
# 1. Check current power
npu-smi info -t power -i 0 -c 0

# 2. Set power limit
npu-smi set -t power-limit -i 0 -c 0 -d 300

# 3. Verify setting
npu-smi info -t power -i 0 -c 0

# 4. Check if within hardware limits
npu-smi info -t board -i 0
```

---

## Log Collection Issues

### Log Collection Not Working

#### Solution
```bash
# 1. Enable log persistence
npu-smi set -t sys-log-enable -d 1

# 2. Verify path exists
mkdir -p /var/log/npu

# 3. Collect logs
npu-smi set -t sys-log-dump -s 3 -f /var/log/npu

# 4. Check logs
ls -la /var/log/npu/

# 5. Clear configuration if needed
npu-smi set -t clear-syslog-cfg
```

### Cannot Clear Log Config

#### Solution
```bash
# 1. Check if log collection is running
ps aux | grep npu-smi

# 2. Kill hanging processes if needed
kill -9 <pid>

# 3. Clear configuration
npu-smi set -t clear-syslog-cfg

# 4. Verify
npu-smi info -t sys-log-enable
```

---

## Error Codes

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| 1 | Permission denied | Run with sudo |
| 2 | Device not found | Check device connection |
| 3 | Invalid parameter | Check parameter values |
| 4 | Command not supported | Check hardware platform |
| 5 | Resource busy | Wait and retry |
| 6 | Timeout | Check device status |
| 7 | File not found | Verify file path |
| 8 | Invalid file format | Check file format |
| 9 | Upgrade in progress | Wait for completion |
| 10 | Upgrade failed | Check logs and retry |

### Log File Locations

| Log File | Description |
|----------|-------------|
| `/var/log/nputools_LOG_ERR.log` | Error logs |
| `/var/log/nputools_LOG_INFO.log` | Info logs |
| `/var/log/npu/` | Collected logs |

---

## General Troubleshooting Steps

### 1. Check Basic Status
```bash
# List devices
npu-smi info -l

# Check health
npu-smi info -t health -i 0

# View board info
npu-smi info -t board -i 0
```

### 2. Check Driver Status
```bash
# Check if driver is loaded
lsmod | grep drv

# Check kernel messages
dmesg | grep -i npu

# Check device files
ls -la /dev/davinci*
```

### 3. Check System Resources
```bash
# Check memory
free -h

# Check CPU
top

# Check disk space
df -h
```

### 4. Collect Debug Information
```bash
# Enable verbose logging
export NPU_SMI_DEBUG=1

# Run command
npu-smi info -l

# Check logs
tail -f /var/log/nputools_LOG_ERR.log
```

---

## Getting Help

### Documentation
- SKILL.md - Main skill documentation
- COMMANDS.md - Detailed command reference
- WORKFLOWS.md - Common workflows

### Huawei Resources
- Huawei Ascend NPU Official Documentation
- npu-smi Command Reference Manual

### Log Collection for Support
```bash
# Collect all relevant information
npu-smi info -l > npu_info.txt
npu-smi info -t board -i 0 >> npu_info.txt
npu-smi info -t version -i 0 -c 0 >> npu_info.txt
npu-smi info -t product -i 0 -c 0 >> npu_info.txt
dmesg > dmesg.txt
```
