# vim: set ts=4 sw=4 tw=79 et :
from setuptools import setup
import platform
from get_git_version import get_git_version

data_files = [ ('/etc/fluxios', ['fluxios.cfg']) ]
distro = platform.dist()[0]
distro_ver = int(platform.dist()[1].split('.')[0])
if distro in ['centos', 'redhat', 'fedora']:
    data_files.append(('/usr/bin', ['fluxios.py']))
    if distro_ver >= 7:
        data_files.append(('/usr/lib/systemd/system',
                          ['packaging/systemd/fluxios.service']))
    elif distro_ver < 7:
        data_files.append(('/etc/rc.d/init.d', ['packaging/rhel/fluxios']))

setup(
    name='fluxios',
    version=get_git_version(),
    description='Send nagios perfdata to InfluxDB',
    author='Andy Cobaugh',
    author_email='andrew.cobaugh@gmail.com',
    url='https://github.com/acobaugh/fluxios',
    license='GPLv2',
    scripts=['fluxios.py'],
    data_files=data_files,
    classifiers=[
        'Intended Audience :: System Administrators',
    ],
    keywords='Nagios influxdb metrics',
)
