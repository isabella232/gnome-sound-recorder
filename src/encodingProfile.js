const Gst = imports.gi.Gst;
const GstPbutils = imports.gi.GstPbutils;


var EncodingProfile = {
    Profiles: {
        VORBIS: { index: 0,
            name: 'VORBIS',
            containerCaps: 'application/ogg;audio/ogg;video/ogg',
            audioCaps: 'audio/x-vorbis',
            mimeType: 'audio/x-vorbis' },

        OPUS: { index: 1,
            name: 'OPUS',
            containerCaps: 'application/ogg',
            audioCaps: 'audio/x-opus',
            mimeType: 'audio/x-opus' },

        FLAC: { index: 2,
            name: 'FLAC',
            containerCaps: 'audio/x-flac',
            audioCaps: 'audio/x-flac',
            mimeType: 'audio/x-flac' },

        MP3: { index: 3,
            name: 'MP3',
            containerCaps: 'application/x-id3',
            audioCaps: 'audio/mpeg,mpegversion=(int)1,layer=(int)3',
            mimeType: 'audio/mpeg' },

        M4A: { index: 4,
            name: 'M4A',
            containerCaps: 'video/quicktime,variant=(string)iso',
            audioCaps: 'audio/mpeg,mpegversion=(int)4',
            mimeType: 'audio/mpeg' },
    },



    fromSettings: index => {
        let profile;
        switch (index) {
        case 0:
            profile = EncodingProfile.Profiles.VORBIS;
            break;
        case 1:
            profile = EncodingProfile.Profiles.OPUS;
            break;
        case 2:
            profile = EncodingProfile.Profiles.FLAC;
            break;
        case 3:
            profile = EncodingProfile.Profiles.MP3;
            break;
        case 4:
            profile = EncodingProfile.Profiles.M4A;
            break;
        }

        return EncodingProfile.create(profile);
    },


    create: profile => {
        let audioCaps = Gst.Caps.from_string(profile.audioCaps);
        let encodingProfile = GstPbutils.EncodingAudioProfile.new(audioCaps, null, null, 1);
        let containerCaps = Gst.Caps.from_string(profile.containerCaps);
        let containerProfile = GstPbutils.EncodingContainerProfile.new('record', null, containerCaps, null);
        containerProfile.add_profile(encodingProfile);

        return containerProfile;
    },
};
